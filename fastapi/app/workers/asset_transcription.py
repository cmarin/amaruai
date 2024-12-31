import time
import logging
import asyncio
from datetime import datetime
from multiprocessing import Pool
import os
import sys
from pathlib import Path

# Add the parent directory to sys.path to allow imports from app
file_path = Path(__file__).resolve()
root_path = file_path.parents[2]  # Go up two levels from app/workers/asset_transcription.py
sys.path.append(str(root_path))

from app.config.supabase import supabase_client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(process)d - %(message)s'
)
logger = logging.getLogger(__name__)

class TranscriptionWorker:
    def __init__(self, worker_id):
        self.worker_id = worker_id
        self.visibility_timeout = 300  # 5 minutes
        self.poll_interval = 30  # seconds between polls if queue is empty
        
    async def process_message(self, message):
        try:
            logger.info(f"Worker {self.worker_id} processing message: {message['msg_id']}")
            # TODO: Implement your transcription logic here
            
            # Archive message after successful processing
            supabase_client.rpc(
                'archive',
                {
                    'queue_name': 'asset_transcription',
                    'msg_id': message['msg_id']
                }
            ).execute()
            
        except Exception as e:
            logger.error(f"Worker {self.worker_id} failed to process message: {str(e)}")
            # Message will become visible again after visibility timeout
    
    async def run(self):
        logger.info(f"Worker {self.worker_id} started")
        
        while True:
            try:
                # Try to read a message from the queue
                # Update the read RPC call in the TranscriptionWorker class
                result = supabase_client.rpc(
                    'read',
                    {
                        'queue_name': 'asset_transcription',
                        'n': 1,  # Number of messages to read
                        'sleep_seconds': 0  # Required parameter
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
