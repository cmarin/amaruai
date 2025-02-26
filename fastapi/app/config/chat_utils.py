import json
import logging
from uuid import UUID
from urllib.parse import unquote
from app import crud
from app.config.asset_utils import resolve_file_url_to_asset

logger = logging.getLogger(__name__)

active_connections = 0

class UUIDEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, UUID):
            return str(obj)
        return super().default(obj)


async def cleanup_connection():
    """
    Decrement the active connection count and log remaining connections.
    """
    global active_connections
    active_connections -= 1
    logger.info(f"Connection cleanup completed. Remaining connections: {active_connections}")


def process_attached_files(db, chat_data, local_messages):
    """
    Process any attached files in the chat data, log relevant info, and
    append images to the last user message following the OpenRouter format.
    Also appends document content to the last user message.
    """
    if not chat_data.files:
        return

    logger.info(f"Processing {len(chat_data.files)} files")

    # Track if we found assets with content
    found_assets = []

    # First pass: Log and fetch any corresponding assets from the database
    for file in chat_data.files:
        # Use the centralized utility function to resolve the file URL to an asset
        result = resolve_file_url_to_asset(db, file.url, file.name)
        
        if result and result["asset"]:
            asset = result["asset"]
            if asset.content:
                # Log the first 200 chars of content for debugging
                logger.info(f"Content preview: {asset.content[:200]}...")
                found_assets.append(asset)

    # Second pass: Append file content to the last user message
    last_user_message_index = -1
    for i in range(len(local_messages) - 1, -1, -1):
        if local_messages[i]["role"] == "user":
            last_user_message_index = i
            break
    
    if last_user_message_index == -1:
        logger.warning("No user message found to append file content to")
        return
    
    # Process images first
    for file in chat_data.files:
        filename = file.name.lower()
        # Check if file is an image based on extension
        if any(ext in filename for ext in [".png", ".jpg", ".jpeg", ".webp"]):
            # If the content is a string, convert it to a list with existing text
            if isinstance(local_messages[last_user_message_index]["content"], str):
                original_text = local_messages[last_user_message_index]["content"]
                local_messages[last_user_message_index]["content"] = [
                    {"type": "text", "text": original_text}
                ]
            # Append the image content part using OpenRouter's schema
            local_messages[last_user_message_index]["content"].append({
                "type": "image_url",
                "image_url": {
                    "url": file.url,
                    "detail": "auto"
                }
            })
            logger.info(f"Appended image {file.name} to last user message")
    
    # Now process document content
    if found_assets:
        # Prepare to append content from documents
        if isinstance(local_messages[last_user_message_index]["content"], list):
            # We already converted to a list for images, append as text
            doc_content = "\n\nAttached Document Content:\n"
            for asset in found_assets:
                doc_content += f"\n--- {asset.file_name} ---\n{asset.content}\n"
            
            # Find the first text element or append a new one
            text_found = False
            for item in local_messages[last_user_message_index]["content"]:
                if item.get("type") == "text":
                    item["text"] += doc_content
                    text_found = True
                    break
            
            if not text_found:
                local_messages[last_user_message_index]["content"].append({
                    "type": "text", 
                    "text": doc_content
                })
        else:
            # Content is still a string, append directly
            doc_content = "\n\nAttached Document Content:\n"
            for asset in found_assets:
                doc_content += f"\n--- {asset.file_name} ---\n{asset.content}\n"
            
            local_messages[last_user_message_index]["content"] += doc_content
        
        logger.info(f"Appended content from {len(found_assets)} document(s) to the last user message")
    
    # Log the final content of the message for debugging
    logger.info("Final message content after processing files:")
    if isinstance(local_messages[last_user_message_index]["content"], str):
        logger.info(f"Content (first 200 chars): {local_messages[last_user_message_index]['content'][:200]}...")
    else:
        logger.info(f"Content structure: {json.dumps(local_messages[last_user_message_index]['content'][:2], cls=UUIDEncoder)}")


def process_referenced_knowledge(db, chat_data, local_messages, chat_model=None):
    """
    Process referenced knowledge bases and assets with RAG or full content retrieval,
    and append the retrieved content to the last user message.
    """
    if not (chat_data.knowledge_base_ids or chat_data.asset_ids):
        logger.info("No knowledge_base_ids or asset_ids found for referencing")
        return

    # Lazy import (or top-level import) from your RAG utility
    from app.config.rag_utils import get_optimized_reference_content

    reference_content, content_tokens, used_rag = get_optimized_reference_content(
        db=db,
        query_text=chat_data.message,
        knowledge_base_ids=chat_data.knowledge_base_ids,
        asset_ids=chat_data.asset_ids,
        max_tokens=chat_model.max_tokens if chat_model else None,
        token_threshold=0.75
    )

    if reference_content:
        # Append reference content to the last user message
        for i in range(len(local_messages) - 1, -1, -1):
            if local_messages[i]["role"] == "user":
                local_messages[i]["content"] += "\n\nReferenced Content:" + reference_content
                strategy = "RAG" if used_rag else "full content"
                logger.info(
                    f"Added referenced content using {strategy} strategy "
                    f"with {content_tokens} tokens"
                )
                logger.info(f"Reference content preview: {reference_content[:200]}...")
                break