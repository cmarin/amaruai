import logging
from typing import List, Optional, Tuple, Set
from uuid import UUID
from sqlalchemy.orm import Session
from app import crud
from app.embeddings import find_relevant_chunks
from llama_index.core.utils import count_tokens
from app.config.asset_utils import collect_reference_content
from app.models import Asset

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
    max_tokens: Optional[int] = None,
    token_threshold: float = 0.75
) -> Tuple[str, int, bool]:
    """
    Get optimized reference content from knowledge bases and assets.
    """
    logger.info("Starting content retrieval with:")
    logger.info(f"- Asset IDs: {asset_ids}")
    logger.info(f"- Knowledge Base IDs: {knowledge_base_ids}")

    try:
        all_content = []
        total_tokens = 0

        # Process direct assets first
        if asset_ids:
            direct_assets = db.query(Asset).filter(
                Asset.id.in_(asset_ids)
            ).all()
            logger.info(f"Found {len(direct_assets)} direct assets")
            
            for asset in direct_assets:
                if asset.content:
                    logger.info(f"Processing asset {asset.id} - {asset.title}")
                    logger.info(f"- Content preview: {asset.content[:100]}...")
                    all_content.append(asset.content)
                    total_tokens += asset.token_count or 0

        # Process knowledge base assets
        if knowledge_base_ids:
            for kb_id in knowledge_base_ids:
                kb = db.query(Asset).join(
                    Asset.knowledge_base_assets
                ).filter(
                    Asset.knowledge_base_assets.c.knowledge_base_id == kb_id
                ).first()
                
                if kb and kb.assets:  # Use the relationship we defined
                    logger.info(f"Processing knowledge base {kb.id} - {kb.title}")
                    logger.info(f"Found {len(kb.assets)} assets in knowledge base")
                    
                    for asset in kb.assets:
                        if asset.content:
                            logger.info(f"Processing KB asset {asset.id} - {asset.title}")
                            logger.info(f"- Content preview: {asset.content[:100]}...")
                            all_content.append(asset.content)
                            total_tokens += asset.token_count or 0

        if not all_content:
            logger.warning("No content found in any assets or knowledge bases")
            return "", 0, False

        combined_content = "\n\n".join(all_content)
        logger.info(f"- Token count: {total_tokens}")

        # If we're under the token threshold or no max_tokens specified, return full content
        if not max_tokens or total_tokens <= (max_tokens * token_threshold):
            logger.info(f"Using full content with {total_tokens} tokens")
            return combined_content, total_tokens, False

        # Otherwise, use RAG to get relevant content
        logger.info("Content exceeds threshold, using RAG optimization")
        
        # Convert UUIDs to strings for the chunks query
        asset_id_strings = [str(aid) for aid in (asset_ids or [])]
        if knowledge_base_ids:
            # Add asset IDs from knowledge bases
            kb_asset_ids = [str(asset.id) for kb_id in knowledge_base_ids
                          for asset in crud.get_knowledge_base(db, kb_id).assets]
            asset_id_strings.extend(kb_asset_ids)

        # Get chunks without max_tokens parameter
        chunks = find_relevant_chunks(
            query_text=query_text,
            asset_ids=asset_id_strings  # Pass only asset_ids as strings
        )
        
        if not chunks:
            logger.warning("No relevant chunks found")
            return "", 0, True

        # Post-process chunks to respect token limit
        chunk_texts = []
        current_tokens = 0
        
        for chunk in chunks:
            chunk_text = chunk['text']
            chunk_token_count = count_tokens(chunk_text)
            
            if current_tokens + chunk_token_count > max_tokens:
                break
                
            chunk_texts.append(chunk_text)
            current_tokens += chunk_token_count

        combined_content = "\n\n".join(chunk_texts)
        final_tokens = count_tokens(combined_content)
        
        logger.info(f"Using RAG content with {final_tokens} tokens")
        return combined_content, final_tokens, True

    except Exception as e:
        logger.error(f"Error in get_optimized_reference_content: {str(e)}")
        return "", 0, False