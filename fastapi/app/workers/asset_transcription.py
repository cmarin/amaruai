import time
import logging
import asyncio
from datetime import datetime
from multiprocessing import Pool
import os
import sys
import json
import tempfile
from pathlib import Path
from uuid import UUID
import urllib.parse

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import tiktoken

# Local utilities
from .docling_util import DoclingService
from .whisper_util import WhisperService
from .video_utils import VideoService


# Load environment variables
load_dotenv()

# Adjust sys.path for local imports
file_path = Path(__file__).resolve()
root_path = file_path.parents[2]  # Go up two levels
sys.path.append(str(root_path))

from app.config.supabase import supabase_client
from app import crud
from app.database import get_db, Base

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable must be set")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(process)d - %(message)s'
)
logger = logging.getLogger(__name__)

# Suppress noisy HTTP/2 logs
logging.getLogger('hpack').setLevel(logging.WARNING)
logging.getLogger('httpx').setLevel(logging.WARNING)
logging.getLogger('httpcore').setLevel(logging.WARNING)

class TranscriptionWorker:
    def __init__(self, worker_id: int):
        self.worker_id = worker_id
        self.visibility_timeout = 300
        self.poll_interval = 30
        self.bucket_name = os.getenv("SUPABASE_BUCKET")
        if not self.bucket_name:
            logger.error("SUPABASE_BUCKET environment variable is not set")
            raise ValueError("SUPABASE_BUCKET environment variable must be set")

        # Create necessary directories
        os.makedirs("/tmp/.EasyOCR/model", exist_ok=True)
        os.makedirs("/tmp/models", exist_ok=True)

        # Instantiate services
        self.docling_service = DoclingService()
        self.whisper_service = WhisperService()
        self.video_service = VideoService()
  

    def count_tokens(self, text: str) -> int:
        """
        Count tokens in text using GPT-3.5/4 tokenizer
        """
        encoder = tiktoken.encoding_for_model("gpt-3.5-turbo")
        return len(encoder.encode(text))

    async def update_asset_status(self, asset_id: UUID, status: str, error_message: str = None):
        """Update asset status and error message in database"""
        db = SessionLocal()
        try:
            asset = crud.get_asset(db, asset_id=asset_id)
            if asset:
                asset.status = status
                if error_message:
                    asset.error_message = error_message
                db.commit()
                logger.info(f"Updated status of asset {asset_id} to {status}")
            else:
                logger.warning(f"No asset found with ID: {asset_id}")
        finally:
            db.close()

    async def process_message(self, message: dict):
        try:
            logger.info(f"Worker {self.worker_id} processing message: {message['msg_id']}")
            logger.debug(f"Full message structure: {message}")

            msg_data = json.loads(message.get('message', '{}'))
            logger.debug(f"Parsed message data: {msg_data}")

            if not msg_data or 'payload' not in msg_data:
                logger.error(f"Invalid message format. Expected 'payload' in message data: {msg_data}")
                raise ValueError("Invalid message format")

            file_url = msg_data['payload']['file_url']
            asset_id = msg_data['payload']['asset_id']
            persona_id = msg_data['payload'].get('persona_id', None)
            
            # Check if the asset already has content (skip if already processed)
            db = SessionLocal()
            try:
                asset = crud.get_asset(db, asset_id=asset_id)
                if asset and asset.content:
                    # Finalize status to avoid dangling "processing"/"failed" records in the UI
                    if getattr(asset, "status", None) != "completed":
                        asset.status = "completed"
                        db.commit()
                    logger.info(f"Asset {asset_id} already has content, skipping processing")
                    return
            finally:
                db.close()

            # Create a temporary directory for processing
            with tempfile.TemporaryDirectory() as temp_dir:
                try:
                    storage_client = supabase_client.storage.from_(self.bucket_name)
                    
                    try:
                        # Get the directory path and filename separately
                        dir_path = os.path.dirname(file_url)
                        filename = os.path.basename(file_url)
                        
                        logger.info(f"Checking directory: {dir_path}")
                        logger.info(f"Looking for file: {filename}")
                        
                        # List files in the directory
                        try:
                            files = storage_client.list(dir_path)
                            logger.debug(f"Files in directory: {files}")
                        except Exception as e:
                            logger.error(f"Error listing directory {dir_path}: {str(e)}")
                            files = []

                        # Check if file exists
                        file_exists = any(f['name'] == filename for f in files)
                        if not file_exists:
                            error_msg = f"File not found in storage: {filename} in {dir_path}"
                            logger.error(error_msg)
                            await self.update_asset_status(asset_id, "failed", error_msg)
                            return

                        # Try to download using the original path first
                        try:
                            logger.info(f"Attempting to download: {file_url}")
                            data = storage_client.download(file_url)
                        except Exception as first_error:
                            # If that fails, try with URL encoding
                            try:
                                encoded_file_url = urllib.parse.quote(file_url, safe='/')
                                logger.info(f"Retrying with encoded URL: {encoded_file_url}")
                                data = storage_client.download(encoded_file_url)
                            except Exception as second_error:
                                error_msg = f"Failed to download file. Original error: {str(first_error)}. Encoded error: {str(second_error)}"
                                logger.error(error_msg)
                                await self.update_asset_status(asset_id, "failed", error_msg)
                                return

                    except Exception as e:
                        error_msg = f"Error accessing storage: {str(e)}"
                        logger.error(error_msg)
                        await self.update_asset_status(asset_id, "failed", error_msg)
                        return

                    # Write downloaded data to temp file
                    temp_file_path = os.path.join(temp_dir, filename)
                    with open(temp_file_path, 'wb') as f:
                        f.write(data)

                    logger.info(f"File downloaded successfully to: {temp_file_path}")
                    
                    # Extract file extension
                    file_ext = os.path.splitext(file_url)[1].lower()
                    audio_temp_dir = None

                    try:
                        if file_ext in [".mp3", ".wav"]:
                            extracted_text = self.whisper_service.transcribe_audio(temp_file_path)
                        elif file_ext in [".mp4", ".mov"]:
                            # 1) Extract MP3 audio
                            mp3_path, audio_temp_dir = self.video_service.extract_audio(temp_file_path)
                            # 2) Then transcribe
                            extracted_text = self.whisper_service.transcribe_audio(mp3_path)
                        elif file_ext in [".txt", ".md", ".markdown"]:
                            # For text and markdown files, just read the content directly
                            # Use errors='replace' to avoid hard failures on unexpected encodings
                            with open(temp_file_path, 'r', encoding='utf-8', errors='replace') as f:
                                extracted_text = f.read()
                            logger.debug(f"Successfully read {file_ext} file content")
                        else:
                            extracted_text = self.docling_service.convert_file(temp_file_path)

                        # Avoid logging full document contents (privacy + log volume)
                        preview = extracted_text[:500].replace("\n", " ")
                        logger.debug(f"Extracted text preview (first 500 chars): {preview}")
                        logger.info(f"Extracted text length: {len(extracted_text)} chars")

                        # Update database
                        db = SessionLocal()
                        try:
                            asset = crud.get_asset(db, asset_id=asset_id)
                            if asset:
                                asset.content = extracted_text
                                asset.token_count = self.count_tokens(extracted_text)
                                asset.status = "completed"
                                asset.persona_id = persona_id
                                db.commit()
                                logger.info(f"Successfully updated asset {asset_id} with extracted text")
                            else:
                                logger.error(f"Asset {asset_id} not found in database")
                                raise ValueError(f"Asset {asset_id} not found")
                        finally:
                            db.close()

                    except FileNotFoundError as e:
                        logging.error(f"OCR model file not found: {str(e)}")
                        await self.update_asset_status(asset_id, "failed", "OCR model initialization failed")
                    except Exception as e:
                        logging.error(f"Error processing document: {str(e)}")
                        await self.update_asset_status(asset_id, "failed", f"Processing failed: {str(e)}")

                    finally:
                        # Clean up audio temp directory if it exists
                        if audio_temp_dir and os.path.exists(audio_temp_dir):
                            import shutil
                            shutil.rmtree(audio_temp_dir)

                except Exception as e:
                    error_msg = f"Error processing file: {str(e)}"
                    logger.error(error_msg, exc_info=True)
                    await self.update_asset_status(asset_id, "failed", error_msg)
                    return

        except Exception as e:
            logger.error(f"Worker {self.worker_id} failed to process message: {str(e)}", exc_info=True)
            
        finally:
            # Archive the message whether successful or failed to prevent infinite retries
            max_attempts = 3
            for attempt in range(1, max_attempts + 1):
                try:
                    supabase_client.rpc(
                        'archive',
                        {
                            'queue_name': 'asset_transcription',
                            'message_id': message['msg_id']
                        }
                    ).execute()
                    logger.info(f"Archived message {message['msg_id']}")
                    break
                except Exception as err:
                    if attempt < max_attempts:
                        logger.warning(
                            f"Archive attempt {attempt} failed for message {message['msg_id']}: {err}. Retrying..."
                        )
                        await asyncio.sleep(2 ** attempt)
                    else:
                        logger.error(
                            f"Failed to archive message {message['msg_id']} after {max_attempts} attempts: {err}"
                        )

    async def run(self):
        logger.info(f"Worker {self.worker_id} started")
        while True:
            try:
                # Try to read a message from the queue
                result = supabase_client.rpc(
                    'read',
                    {
                        'queue_name': 'asset_transcription',
                        'sleep_seconds': 0,  # Required param
                        'n': 1              # Required param - number of messages
                    }
                ).execute()

                if result.data and len(result.data) > 0:
                    message = result.data[0]
                    await self.process_message(message)
                else:
                    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    logger.info(f"Worker {self.worker_id} alive at {current_time} - No messages in queue")
                    await asyncio.sleep(self.poll_interval)

            except Exception as e:
                logger.error(f"Worker {self.worker_id} encountered error: {str(e)}")
                await asyncio.sleep(self.poll_interval)


def worker_process(worker_id: int):
    """
    Entry point for each worker process
    """
    try:
        worker = TranscriptionWorker(worker_id)
        asyncio.run(worker.run())
    except Exception as e:
        logger.error(f"Worker process {worker_id} failed: {str(e)}")
        raise

def start_workers():
    num_workers = min(os.cpu_count() - 2, 4)  # Leave at least one CPU free
    logger.info(f"Starting {num_workers} workers")

    from multiprocessing import Pool
    with Pool(processes=num_workers) as pool:
        try:
            pool.map(worker_process, range(num_workers))
        except KeyboardInterrupt:
            logger.info("Shutting down workers")
            pool.terminate()
            pool.join()
        except Exception as e:
            logger.error(f"Pool execution failed: {str(e)}")
            pool.terminate()
            pool.join()
            raise

if __name__ == "__main__":
    try:
        logger.info("Starting asset transcription worker pool")
        start_workers()
    except Exception as e:
        logger.error(f"Failed to start workers: {str(e)}")
        sys.exit(1)
