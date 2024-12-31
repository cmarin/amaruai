import time
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    logger.info("Asset transcription worker started")
    
    while True:
        try:
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            logger.info(f"Worker alive at {current_time}")
            
            # TODO transcription logic will go here
            
            # Sleep for 90 seconds
            time.sleep(90)
            
        except Exception as e:
            logger.error(f"Error in worker: {str(e)}")
            time.sleep(90)  # Still sleep on error to prevent rapid retries

if __name__ == "__main__":
    main()
