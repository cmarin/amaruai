import logging
from typing import List, Optional, Tuple
from uuid import UUID
from sqlalchemy.orm import Session
from app import crud

logger = logging.getLogger(__name__)

def collect_reference_content(
    db: Session,
    knowledge_base_ids: Optional[List[UUID]] = None,
    asset_ids: Optional[List[UUID]] = None
) -> Tuple[str, int]:
    """
    Collects content from referenced knowledge bases and assets.
    Returns a tuple of (combined_content, total_tokens).
    Now uses the token_count field from knowledge bases.
    """
    combined_content = []
    total_kb_tokens = 0
    total_asset_tokens = 0
    
    # Process knowledge bases first
    if knowledge_base_ids:
        logger.info(f"Processing {len(knowledge_base_ids)} knowledge bases")
        for kb_id in knowledge_base_ids:
            try:
                kb = crud.get_knowledge_base(db, kb_id)
                if kb:
                    # Get assets directly from the knowledge base relationship
                    if kb.assets:
                        for asset in kb.assets:
                            if asset.content:
                                combined_content.append(f"\nKnowledge Base: {kb.title}\nContent:\n{asset.content}\n")
                        # Use the stored token count from the knowledge base
                        total_kb_tokens += kb.token_count or 0
                        logger.info(f"Added content from knowledge base {kb.title} with {kb.token_count} tokens")
                    else:
                        logger.warning(f"No assets found in knowledge base {kb.title}")
                else:
                    logger.warning(f"Knowledge base not found: {kb_id}")
            except Exception as e:
                logger.error(f"Error processing knowledge base {kb_id}: {str(e)}", exc_info=True)
    
    # Process individual assets
    if asset_ids:
        logger.info(f"Processing {len(asset_ids)} individual assets")
        for asset_id in asset_ids:
            try:
                asset = crud.get_asset(db, asset_id)
                if asset:
                    if asset.content:
                        combined_content.append(f"\nAsset: {asset.file_name}\nContent:\n{asset.content}\n")
                        # Calculate tokens for individual assets
                        asset_tokens = len(asset.content.split())
                        total_asset_tokens += asset_tokens
                        logger.info(f"Added content from asset {asset.file_name} with {asset_tokens} tokens")
                    else:
                        logger.warning(f"No content found in asset {asset_id} (file: {asset.file_name})")
                else:
                    logger.warning(f"Asset not found: {asset_id}")
            except Exception as e:
                logger.error(f"Error processing asset {asset_id}: {str(e)}", exc_info=True)

    total_tokens = total_kb_tokens + total_asset_tokens
    logger.info(f"Total tokens from knowledge bases: {total_kb_tokens}")
    logger.info(f"Total tokens from individual assets: {total_asset_tokens}")
    logger.info(f"Combined total tokens: {total_tokens}")
    
    return "".join(combined_content), total_tokens 