from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database import get_db, DATABASE_URL
from app.api.v1.router import create_protected_router
from app.embeddings import text_to_embedding, find_relevant_chunks
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Create a protected router for RAG endpoints
router = create_protected_router(prefix="rag", tags=["rag"])

@router.post("/search")
async def search_chunks(
    query: str,
    num_chunks: Optional[int] = 5,
    similarity_cutoff: Optional[float] = 0.7,
    db: Session = Depends(get_db)
):
    """
    Search for relevant chunks using RAG (Retrieval Augmented Generation).
    
    Args:
        query (str): The text query to search for
        num_chunks (int, optional): Number of chunks to return. Defaults to 5.
        similarity_cutoff (float, optional): Minimum similarity score threshold. Defaults to 0.7.
        
    Returns:
        list[dict]: List of relevant chunks with their metadata and similarity scores
    """
    try:
        # Convert query to embedding
        query_embedding = text_to_embedding(query)
        
        # Find relevant chunks
        chunks = find_relevant_chunks(
            embedding=query_embedding,
            postgres_connection_string=DATABASE_URL,
            num_chunks=num_chunks,
            similarity_cutoff=similarity_cutoff
        )
        
        return {
            "chunks": chunks,
            "total": len(chunks)
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in RAG search: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
