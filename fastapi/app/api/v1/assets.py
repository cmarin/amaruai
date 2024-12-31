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
    """
    Queue an asset for transcription using Supabase queues.
    The asset will be marked as 'processing' and added to the asset_transcription queue.
    """
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
        
        # Queue the transcription task
        try:
            # Send to Supabase queue using pgmq_public.send
            data = supabase_client.rpc(
                'send',
                {
                    'queue_name': 'asset_transcription',
                    'msg': json.dumps(message_payload),
                    'metadata': json.dumps({"asset_id": str(asset_id)})
                },
                schema='pgmq_public'
            ).execute()
            
            logger.info(f"Successfully queued transcription task: {data}")
            
        except Exception as e:
            logger.error(f"Failed to queue transcription task: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to queue transcription task: {str(e)}"
            )
        
        # Update the asset status to 'processing'
        try:
            updated_asset = crud.update_asset_status(
                db=db,
                asset_id=asset_id,
                status="processing"
            )
            if not updated_asset:
                logger.error(f"Failed to update asset status for asset_id: {asset_id}")
                # Don't raise here since the task is already queued
        except Exception as e:
            logger.error(f"Error updating asset status: {str(e)}", exc_info=True)
            # Don't raise here since the task is already queued
        
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