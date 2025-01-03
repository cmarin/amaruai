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

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import tiktoken

# Local utilities
from .docling_util import DoclingService
from .whisper_utility import WhisperUtility

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

        # Instantiate the DoclingService
        self.docling_service = DoclingService()

        # Instantiate the Whisper utility for audio
        self.whisper_utility = WhisperUtility(model_name="medium")

    def count_tokens(self, text: str) -> int:
        """
        Count tokens in text using GPT-3.5/4 tokenizer
        """
        encoder = tiktoken.encoding_for_model("gpt-3.5-turbo")
        return len(encoder.encode(text))

    async def process_message(self, message: dict):
        try:
            logger.info(f"Worker {self.worker_id} processing message: {message['msg_id']}")
            logger.debug(f"Full message structure: {message}")

            # Parse the message body - PGMQ uses 'message' field
            msg_data = json.loads(message.get('message', '{}'))
            logger.debug(f"Parsed message data: {msg_data}")

            if not msg_data or 'payload' not in msg_data:
                logger.error(f"Invalid message format. Expected 'payload' in message data: {msg_data}")
                raise ValueError("Invalid message format")

            file_url = msg_data['payload']['file_url']
            asset_id = msg_data['payload']['asset_id']

            logger.info(f"Downloading file from path: {file_url}")

            # Create a temporary directory for processing
            with tempfile.TemporaryDirectory() as temp_dir:
                try:
                    # Download file from Supabase
                    data = supabase_client.storage.from_(self.bucket_name).download(file_url)
                    temp_file_path = os.path.join(temp_dir, os.path.basename(file_url))

                    # Write the binary data to a temporary file
                    with open(temp_file_path, 'wb') as f:
                        f.write(data)

                    logger.info(f"File downloaded successfully to: {temp_file_path}")

                    # Detect file extension: route to either Whisper (mp3/wav) or Docling
                    file_ext = os.path.splitext(file_url)[1].lower()
                    if file_ext in [".mp3", ".wav"]:
                        extracted_text = self.whisper_utility.transcribe_audio(temp_file_path)
                    else:
                        extracted_text = self.docling_service.convert_file(temp_file_path)

                    logger.info("Successfully extracted text:")
                    logger.info("=" * 50)
                    logger.info(extracted_text)
                    logger.info("=" * 50)

                    # Update database
                    db = SessionLocal()
                    try:
                        asset = crud.get_asset(db, asset_id=asset_id)
                        if asset:
                            asset.content = extracted_text
                            asset.token_count = self.count_tokens(extracted_text)
                            asset.status = "completed"
                            db.commit()
                            logger.info(f"Successfully updated asset {asset_id} with extracted text")
                        else:
                            logger.error(f"Asset {asset_id} not found in database")
                            raise ValueError(f"Asset {asset_id} not found")
                    finally:
                        db.close()

                except Exception as e:
                    logger.error(f"Error processing file: {str(e)}", exc_info=True)
                    # Update asset status to failed
                    db = SessionLocal()
                    try:
                        crud.update_asset_status(db, asset_id=asset_id, status="failed")
                    finally:
                        db.close()
                    raise

            # Archive the message after successful processing
            supabase_client.rpc(
                'archive',
                {
                    'queue_name': 'asset_transcription',
                    'message_id': message['msg_id']
                }
            ).execute()

        except Exception as e:
            logger.error(f"Worker {self.worker_id} failed to process message: {str(e)}", exc_info=True)
            # The message will become visible again after the visibility timeout

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
