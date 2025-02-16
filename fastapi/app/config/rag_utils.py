import logging
from typing import List, Optional, Tuple, Set
from uuid import UUID
from sqlalchemy.orm import Session
from app import crud
from app.embeddings import find_relevant_chunks
from llama_index.core.utils import count_tokens
from app.config.asset_utils import collect_reference_content

logger = logging.getLogger(__name__)

def get_all_asset_ids(
    db: Session,
    knowledge_base_ids: Optional[List[UUID]] = None,
    asset_ids: Optional[List[UUID]] = None
) -> Set[str]:
    """
    Collects all asset IDs from both direct asset references and knowledge bases.
    
    Args:
        db: Database session
        knowledge_base_ids: Optional list of knowledge base IDs
        asset_ids: Optional list of asset IDs
        
    Returns:
        Set of asset IDs as strings
    """
    all_asset_ids = set()
    
    # Add direct asset IDs
    if asset_ids:
        all_asset_ids.update(str(aid) for aid in asset_ids)
    
    # Add asset IDs from knowledge bases
    if knowledge_base_ids:
        for kb_id in knowledge_base_ids:
            kb = crud.get_knowledge_base(db, kb_id)
            if kb and kb.assets:
                all_asset_ids.update(str(asset.id) for asset in kb.assets)
    
    return all_asset_ids

def get_optimized_reference_content(
    db: Session,
    query_text: str,
    knowledge_base_ids: Optional[List[UUID]] = None,
    asset_ids: Optional[List[UUID]] = None,
    max_tokens: int = 4096,
    token_threshold: float = 0.75
) -> Tuple[str, int, bool]:
    """
    Gets reference content, optimizing for token count by switching to RAG when needed.
    
    Args:
        db: Database session
        query_text: The user's query text
        knowledge_base_ids: Optional list of knowledge base IDs
        asset_ids: Optional list of asset IDs
        max_tokens: Maximum tokens allowed for the model
        token_threshold: Threshold as a percentage of max_tokens before switching to RAG
        
    Returns:
        Tuple of (reference_content, total_tokens, used_rag)
    """
    # First collect reference content and get token count
    reference_content, total_reference_tokens = collect_reference_content(
        db,
        knowledge_base_ids,
        asset_ids
    )
    
    # Calculate query tokens
    query_tokens = count_tokens(query_text)
    total_tokens = total_reference_tokens + query_tokens
    token_limit = int(max_tokens * token_threshold)
    
    # If we're under the threshold, use the full content
    if total_tokens <= token_limit:
        logger.info(f"Using full reference content ({total_tokens} tokens)")
        return reference_content, total_tokens, False
        
    # If we're over the threshold, switch to RAG
    logger.info(f"Token count ({total_tokens}) exceeds {token_limit} threshold. Switching to RAG strategy.")
    
    # Get all asset IDs
    all_asset_ids = get_all_asset_ids(db, knowledge_base_ids, asset_ids)
    
    # Use RAG to find relevant chunks
    relevant_chunks = find_relevant_chunks(
        query_text=query_text,
        num_chunks=5,  # Adjust based on needs
        asset_ids=list(all_asset_ids) if all_asset_ids else None
    )
    
    # Log the retrieved chunks
    logger.info("Retrieved the following chunks:")
    for i, chunk in enumerate(relevant_chunks, 1):
        logger.info(f"Chunk {i} (score: {chunk['score']:.3f}):")
        logger.info(f"Text: {chunk['text'][:200]}..." if len(chunk['text']) > 200 else f"Text: {chunk['text']}")
        if chunk['metadata'].get('source'):
            logger.info(f"Source: {chunk['metadata']['source']}")
        logger.info("-" * 50)
    
    # Format chunks into reference content
    rag_content = "\nRelevant Content:\n"
    for chunk in relevant_chunks:
        rag_content += f"\n{chunk['text']}\n"
        if chunk['metadata'].get('source'):
            rag_content += f"(Source: {chunk['metadata']['source']})\n"
    
    # Calculate new token count
    rag_tokens = count_tokens(rag_content) + query_tokens
    logger.info(f"RAG optimization reduced tokens from {total_tokens} to {rag_tokens}")
    
    return rag_content, rag_tokens, True