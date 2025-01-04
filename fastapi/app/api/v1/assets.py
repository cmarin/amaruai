from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.api.v1.router import create_protected_router
from app import crud
from uuid import UUID
import logging
from app.config.supabase import supabase_client
import json

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Create a protected router for assets
router = create_protected_router(prefix="assets", tags=["assets"])

@router.post("/{asset_id}/transcribe")
async def transcribe_asset(
    asset_id: UUID,
    db: Session = Depends(get_db)
):
    logger.info(f"Transcribe endpoint called with asset_id: {asset_id}")
    
    try:
        # Get the asset to verify it exists and get its details
        asset = crud.get_asset(db, asset_id=asset_id)
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
            
        # Prepare the message payload
        message_payload = {
            "task": "transcribe_asset",
            "payload": {
                "asset_id": str(asset_id),
                "file_url": asset.file_url,
                "mime_type": asset.mime_type,
                "file_type": asset.file_type
            }
        }
        
        # Queue the transcription task using direct SQL
        try:
            data = supabase_client.rpc(
                'send',
                {
                    'queue_name': 'asset_transcription',
                    'message': json.dumps(message_payload),
                    'sleep_seconds': 0
                }
            ).execute()
            
            logger.info(f"Successfully queued transcription task: {data}")
            
        except Exception as e:
            logger.error(f"Failed to queue transcription task: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to queue transcription task: {str(e)}"
            )
        
        # Update the asset status
        try:
            updated_asset = crud.update_asset_status(
                db=db,
                asset_id=asset_id,
                status="processing"
            )
            if not updated_asset:
                logger.error(f"Failed to update asset status for asset_id: {asset_id}")
        except Exception as e:
            logger.error(f"Error updating asset status: {str(e)}", exc_info=True)
        
        return {
            "message": "Transcription queued successfully",
            "asset_id": str(asset_id),
            "status": "processing"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in transcribe_asset: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/test-queue")
async def test_queue():
    try:
        data = supabase_client.rpc(
            'send',
            {
                'queue_name': 'asset_transcription',
                'message': json.dumps({"test": "message"}),
                'sleep_seconds': 0
            }
        ).execute()
        
        return {"message": "Queue test successful"}
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Queue test failed: {str(e)}"
        )

@router.get("/status")
async def get_asset_status(
    url: str,
    db: Session = Depends(get_db)
):
    """
    Get asset status by file URL.
    The URL parameter should be in the format: chats/user_id/uuid/filename.txt
    """
    logger.info(f"Getting asset status for URL: {url}")
    
    try:
        # Find the asset by file URL
        asset = crud.get_asset_by_file_url(db, file_url=url)
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
            
        return {
            "id": str(asset.id),
            "status": asset.status,
            "token_count": asset.token_count,
            "file_name": asset.file_name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting asset status: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))