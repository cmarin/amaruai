import os
import json
import logging
from uuid import UUID
from urllib.parse import unquote
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db, DATABASE_URL
from app.api.v1.router import create_protected_router
from app import crud
from app.config.supabase import supabase_client
from app.embeddings import create_embeddings_for_asset
import psycopg2


logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


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
    The URL parameter can be either:
    1. Relative path: chats/user_id/uuid/filename.txt
    2. Full Supabase URL: https://.../storage/v1/object/public/bucket/chats/user_id/uuid/filename.txt
    """
    logger.info(f"Getting asset status for URL: {url}")
    
    try:
        # Extract the relative path if a full URL is provided
        if url.startswith('http'):
            # Find the index of "chats/" and take everything after it
            chats_index = url.find("chats/")
            if chats_index == -1:
                raise HTTPException(status_code=400, detail="Invalid URL format: 'chats/' not found in path")
            file_url = url[chats_index:]
        else:
            file_url = url
            
        # URL decode the file_url to handle spaces and special characters
        file_url = unquote(file_url)
        logger.info(f"Looking up asset with decoded file_url: {file_url}")
        
        # Find the asset by file URL
        asset = crud.get_asset_by_file_url(db, file_url=file_url)
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
    

@router.post("/{asset_id}/embed")
def embed_asset(
    asset_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Create embeddings for the specified asset's content
    and store them in vecs.<collection_name> via the direct approach.
    """
    # 1) Fetch the asset
    asset = crud.get_asset(db, asset_id=asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # 2) Check that content exists
    if not asset.content:
        raise HTTPException(
            status_code=400,
            detail="Asset has no text to embed. Transcribe or extract text first."
        )

    # 3) Attempt to create embeddings
    from app.embeddings import create_embeddings_for_asset

    success = create_embeddings_for_asset(
        asset_id=str(asset.id),
        document_content=asset.content,
        document_name=asset.file_name,
        postgres_connection_string=DATABASE_URL,  # The same env var from database.py
        collection_name="embeddings",             # or any other collection
        dimension=1536                            # match text-embedding-ada-002
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to create embeddings for this asset.")

    # 4) Optionally, return row count from DB
    row_count = 0
    try:
        import psycopg2
        with psycopg2.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM vecs.embeddings;")
                (row_count,) = cur.fetchone()
    except Exception as e:
        logger.error(f"Could not fetch row count from vecs.embeddings: {str(e)}")

    return {
        "message": "Embeddings created successfully",
        "asset_id": str(asset.id),
        "row_count_in_vecs_embeddings": row_count
    }
