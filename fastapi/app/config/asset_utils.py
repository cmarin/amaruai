import logging
from typing import List, Optional, Tuple, Dict, Any, Union
from uuid import UUID
from sqlalchemy.orm import Session
from urllib.parse import unquote
from app import crud

logger = logging.getLogger(__name__)

def resolve_file_url_to_asset(db: Session, file_url: str, file_name: str = None) -> Optional[Dict[str, Any]]:
    """
    Centralized utility to resolve a file URL to an asset, handling URL decoding and different path prefixes.
    
    Args:
        db: Database session
        file_url: Full or relative URL of the file
        file_name: Optional name of the file for better logging
        
    Returns:
        Dictionary with asset info and relative_url, or None if not found
    """
    if not file_url:
        return None
        
    file_url = file_url.strip(';')
    name_str = f" '{file_name}'" if file_name else ""
    
    try:
        # Check for valid path prefixes (chats/, batch-flow/, or assets/)
        chats_index = file_url.find("chats/")
        batch_flow_index = file_url.find("batch-flow/")
        assets_index = file_url.find("assets/")
        
        # Find the right prefix
        if chats_index != -1:
            relative_url = file_url[chats_index:]
            context = "chats"
        elif batch_flow_index != -1:
            relative_url = file_url[batch_flow_index:]
            context = "batch-flow"
        elif assets_index != -1:
            relative_url = file_url[assets_index:]
            context = "assets"
        else:
            logger.warning(
                f"Invalid file URL format for file{name_str}: "
                f"None of 'chats/', 'batch-flow/', 'assets/' found in {file_url}"
            )
            return None
            
        logger.info(f"Processing file{name_str} from {context} context")
        logger.info(f"Relative URL: {relative_url}")
        
        # URL decode to handle spaces and special characters
        decoded_url = unquote(relative_url)
        logger.info(f"Decoded URL: {decoded_url}")
        
        # Try with decoded URL first (for files with spaces)
        asset = crud.get_asset_by_file_url(db, decoded_url)
        
        # If not found, try with the original encoded URL
        if not asset:
            logger.info(f"No asset found with decoded URL, trying encoded URL: {relative_url}")
            asset = crud.get_asset_by_file_url(db, relative_url)
            
        if asset:
            logger.info(f"Found asset in database: {asset.id}")
            if asset.content:
                logger.info(f"Asset has content ({len(asset.content)} characters)")
                # Return a dict with the asset and relative_url
                return {
                    "asset": asset,
                    "relative_url": relative_url,
                    "decoded_url": decoded_url
                }
            else:
                logger.warning(f"No content found in asset {asset.id} for file{name_str}")
                # Return the asset even if it has no content
                return {
                    "asset": asset,
                    "relative_url": relative_url,
                    "decoded_url": decoded_url
                }
        else:
            logger.warning(
                f"No asset found for file{name_str} with relative URL {relative_url} "
                f"or decoded URL {decoded_url}"
            )
            return None
    except Exception as e:
        logger.error(f"Error processing file{name_str}: {str(e)}", exc_info=True)
        return None


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