from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.api.v1.router import create_protected_router
from app.embeddings import find_relevant_chunks
import logging
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

# Create a protected router for RAG endpoints
router = create_protected_router(prefix="rag", tags=["rag"])

@router.post("/search")
async def search_chunks(
    query: str = Query(..., description="The search query"),
    num_chunks: int = Query(5, description="Number of chunks to return"),
    similarity_cutoff: float = Query(0.7, description="Minimum similarity score threshold"),
    asset_ids: List[str] = Query(
        default=None,
        description="Optional list of asset IDs to filter by. Multiple values can be provided.",
        example=["c1978409-e8bb-417b-b074-f3e94991ecb6"]
    ),
    db: Session = Depends(get_db)
):
    """
    Search for relevant chunks using RAG (Retrieval Augmented Generation).
    
    Args:
        query (str): The search query
        num_chunks (int): Number of chunks to return (default: 5)
        similarity_cutoff (float): Minimum similarity score threshold (default: 0.7)
        asset_ids (list[str]): Optional list of asset IDs to filter by
        
    Returns:
        dict: Dictionary containing chunks and total count
    """
    try:
        # Check for OpenAI API key
        if not os.getenv("OPENAI_API_KEY"):
            raise ValueError("OPENAI_API_KEY environment variable is not set")
            
        # Find relevant chunks using LlamaIndex
        chunks = find_relevant_chunks(
            query_text=query,
            num_chunks=num_chunks,
            similarity_cutoff=similarity_cutoff,
            asset_ids=asset_ids
        )
        
        return {
            "chunks": chunks,
            "total": len(chunks)
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in RAG search: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=400,
            detail=f"Error querying vector store: {str(e)}"
        )
