import logging
from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app import crud

logger = logging.getLogger(__name__)

def collect_reference_content(
    db: Session,
    knowledge_base_ids: Optional[List[UUID]] = None,
    asset_ids: Optional[List[UUID]] = None
) -> tuple[str, int]:
    """
    Collect content from referenced knowledge bases and assets.
    
    Args:
        db (Session): Database session
        knowledge_base_ids (List[UUID], optional): List of knowledge base IDs
        asset_ids (List[UUID], optional): List of asset IDs
        
    Returns:
        tuple[str, int]: Combined content and total token count
    """
    collected_content = []
    total_tokens = 0
    
    # Process individual assets
    if asset_ids:
        logger.info(f"Processing {len(asset_ids)} direct asset references")
        for asset_id in asset_ids:
            asset = crud.get_asset(db, asset_id=asset_id)
            if asset and asset.content:
                collected_content.append(f"\nAsset: {asset.file_name}\nContent:\n{asset.content}\n")
                total_tokens += asset.token_count or 0
                logger.info(f"Added content from asset {asset.id} ({len(asset.content)} characters, {asset.token_count} tokens)")
            else:
                logger.warning(f"Asset {asset_id} not found or has no content")
                
    # Process knowledge bases and their assets
    if knowledge_base_ids:
        logger.info(f"Processing {len(knowledge_base_ids)} knowledge base references")
        for kb_id in knowledge_base_ids:
            kb = crud.get_knowledge_base(db, knowledge_base_id=kb_id)
            if kb:
                logger.info(f"Processing knowledge base: {kb.title} ({kb.id})")
                for asset in kb.assets:
                    if asset.content:
                        collected_content.append(f"\nKnowledge Base: {kb.title}\nAsset: {asset.file_name}\nContent:\n{asset.content}\n")
                        total_tokens += asset.token_count or 0
                        logger.info(f"Added content from KB asset {asset.id} ({len(asset.content)} characters, {asset.token_count} tokens)")
                    else:
                        logger.warning(f"Asset {asset.id} in knowledge base {kb_id} has no content")
            else:
                logger.warning(f"Knowledge base {kb_id} not found")
    
    logger.info(f"Total tokens from all referenced content: {total_tokens}")
    return "\n".join(collected_content), total_tokens 