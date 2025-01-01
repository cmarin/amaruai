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
from docling.document_converter import DocumentConverter
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the parent directory to sys.path to allow imports from app
file_path = Path(__file__).resolve()
root_path = file_path.parents[2]  # Go up two levels from app/workers/asset_transcription.py
sys.path.append(str(root_path))

from app.config.supabase import supabase_client

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(process)d - %(message)s'
)

# Get our application logger
logger = logging.getLogger(__name__)

# Suppress noisy HTTP/2 logs
logging.getLogger('hpack').setLevel(logging.WARNING)
logging.getLogger('httpx').setLevel(logging.WARNING)
logging.getLogger('httpcore').setLevel(logging.WARNING)

class TranscriptionWorker:
    def __init__(self, worker_id):
        self.worker_id = worker_id
        self.visibility_timeout = 300  # 5 minutes
        self.poll_interval = 30  # seconds between polls if queue is empty
        
        # Get bucket name from environment
        self.bucket_name = os.getenv("SUPABASE_BUCKET")
        if not self.bucket_name:
            logger.error("SUPABASE_BUCKET environment variable is not set")
            raise ValueError("SUPABASE_BUCKET environment variable must be set")
        
    async def process_message(self, message):
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
            
            # Use the full path from file_url - it already has the correct structure
            # Example: chats/user_id/uuid/filename.pdf
            logger.info(f"Downloading file from path: {file_url}")
            
            # Create a temporary directory for processing
            with tempfile.TemporaryDirectory() as temp_dir:
                # Download the file
                try:
                    data = supabase_client.storage.from_(self.bucket_name).download(file_url)
                    temp_file_path = os.path.join(temp_dir, os.path.basename(file_url))
                    
                    # Write the binary data to a temporary file
                    with open(temp_file_path, 'wb') as f:
                        f.write(data)
                    
                    logger.info(f"File downloaded successfully to: {temp_file_path}")
                    
                    # Initialize docling converter
                    converter = DocumentConverter()
                    
                    # Convert the document
                    result = converter.convert(temp_file_path)
                    extracted_text = result.document.export_to_markdown()
                    
                    logger.info("Successfully extracted text:")
                    logger.info("=" * 50)
                    logger.info(extracted_text)
                    logger.info("=" * 50)
                    
                except Exception as e:
                    logger.error(f"Error processing file: {str(e)}", exc_info=True)
                    raise
            
            # Archive message after successful processing
            supabase_client.rpc(
                'archive',
                {
                    'queue_name': 'asset_transcription',
                    'message_id': message['msg_id']
                }
            ).execute()
            
        except Exception as e:
            logger.error(f"Worker {self.worker_id} failed to process message: {str(e)}", exc_info=True)
            # Message will become visible again after visibility timeout
    
    async def run(self):
        logger.info(f"Worker {self.worker_id} started")
        
        while True:
            try:
                # Try to read a message from the queue
                result = supabase_client.rpc(
                    'read',
                    {
                        'queue_name': 'asset_transcription',
                        'sleep_seconds': 0,  # Required parameter
                        'n': 1  # Required parameter - number of messages to read
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

def worker_process(worker_id):
    """Entry point for each worker process"""
    try:
        worker = TranscriptionWorker(worker_id)
        asyncio.run(worker.run())
    except Exception as e:
        logger.error(f"Worker process {worker_id} failed: {str(e)}")
        raise

def start_workers():
    # Use CPU count or fixed number based on your needs
    num_workers = min(os.cpu_count() - 1, 4)  # Leave one CPU core free
    logger.info(f"Starting {num_workers} workers")
    
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
