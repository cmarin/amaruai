import os
import json
import uuid
import time
import logging
import aiohttp
from datetime import datetime
from typing import AsyncGenerator
from dotenv import load_dotenv
from uuid import UUID
from fastapi import FastAPI, Request, HTTPException, BackgroundTasks, Depends
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from urllib.parse import unquote

from app.schemas import ChatMessage, Message, FileInfo
from app.api.v1.router import create_protected_router
from app.database import get_db
from app import crud
from app.utils import format_openai_message, log_chat_request
from app.config.asset_utils import resolve_file_url_to_asset

# Existing utility imports
from app.config.chat_utils import (
    cleanup_connection,
    active_connections,
    UUIDEncoder,
    process_attached_files,
    process_referenced_knowledge
)
from app.config.memory_utils import (
    ConversationManager,
    store_user_system_messages_in_memory,
    store_assistant_message_in_memory
)
from app.config.openrouter_utils import stream_openrouter_completions

# New utility import for the Assistants Beta
from app.config.openai_assistant_utils import stream_openai_assistant_completions

# New utility import for OpenAI's vanilla chat completions
from app.config.openai_utils import stream_openai_completions

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
handler = logging.StreamHandler()
handler.setFormatter(formatter)
logger.handlers = [handler]

router = create_protected_router(prefix="chat", tags=["chat"])
load_dotenv()

conversation_manager = ConversationManager()


@router.post("")
async def chat_endpoint(
    request: Request,
    chat_data: ChatMessage,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    try:
        # Log request
        log_chat_request(request, None, chat_data.dict())

        # Conversation IDs
        conversation_id = str(chat_data.conversation_id or uuid.uuid4())
        multi_conversation_id = str(
            getattr(chat_data, 'multi_conversation_id', None) or conversation_id
        )

        # Memory
        try:
            memory = conversation_manager.get_memory_buffer(conversation_id=conversation_id)
        except Exception as e:
            logger.error(f"Failed to initialize memory buffer: {str(e)}")
            memory = None

        # Build messages_list from chat_data
        if hasattr(chat_data, 'data') and chat_data.data:
            if hasattr(chat_data.data, 'messages'):
                messages_list = [m.dict() for m in chat_data.data.messages]
            elif hasattr(chat_data.data, 'message'):
                messages_list = [{"role": "user", "content": chat_data.data.message}]
            else:
                messages_list = [{"role": "user", "content": chat_data.message}]
        elif chat_data.messages and len(chat_data.messages) > 0:
            messages_list = [m.dict() for m in chat_data.messages]
        elif chat_data.message:
            messages_list = [{"role": "user", "content": chat_data.message}]
        else:
            raise HTTPException(status_code=422, detail="No message(s) provided.")

        global active_connections
        start_time = time.time()
        active_connections += 1
        background_tasks.add_task(cleanup_connection)
        logger.info(f"New chat connection. Active connections: {active_connections}")

        # Persona system message and settings
        system_message = ""
        temperature = None
        if chat_data.persona_id:
            persona = crud.get_persona(db, chat_data.persona_id)
            if persona:
                system_message = f"Role: {persona.role}\nGoal: {persona.goal}\n"
                temperature = persona.temperature

        # Determine provider and model
        provider = "openrouter"  # default
        model_name = "openai/chatgpt-4o-latest"
        chat_model = None
        if chat_data.model_id:
            chat_model = crud.get_chat_model(db, chat_data.model_id)
            if chat_model:
                provider = chat_model.provider  # e.g. "openai" or "openai-assistant" or "openrouter"
                model_name = chat_model.model   # e.g. "gpt-4" if openai, "asst-123abc" if openai-assistant

        # Potential thread_id if stored in chat_data or DB
        # (Adjust to how you track thread_id for an Assistant.)
        openai_thread_id = getattr(chat_data, "thread_id", None)
        # Or maybe you store it in DB for the conversation, etc.

        async def event_generator() -> AsyncGenerator[str, None]:
            local_messages = messages_list.copy()
            if system_message:
                local_messages.insert(0, {"role": "system", "content": system_message})

            # File & knowledge processing
            process_attached_files(db, chat_data, local_messages)
            
            # Auto-include attached file assets in asset_ids if they're not already there
            if chat_data.files and not chat_data.asset_ids:
                logger.info("Attempting to auto-include attached file assets")
                attached_asset_ids = []
                for file in chat_data.files:
                    # Use the centralized utility function
                    result = resolve_file_url_to_asset(db, file.url, file.name)
                    if result and result["asset"]:
                        asset = result["asset"]
                        attached_asset_ids.append(asset.id)
                        logger.info(f"Auto-including asset {asset.id} for file {file.name}")
                
                if attached_asset_ids:
                    # Create a new list if chat_data.asset_ids is None, otherwise extend existing
                    if chat_data.asset_ids is None:
                        chat_data.asset_ids = attached_asset_ids
                    else:
                        chat_data.asset_ids.extend(attached_asset_ids)
                    logger.info(f"Auto-included {len(attached_asset_ids)} assets from attached files")
            
            process_referenced_knowledge(db, chat_data, local_messages, chat_model)

            # Memory
            store_user_system_messages_in_memory(
                memory, local_messages, chat_data, multi_conversation_id
            )

            assistant_response_accumulator = []

            logger.info("=" * 50)
            logger.info(f"Using provider: {provider}, model: {model_name}")
            logger.info("Messages:")
            for msg in local_messages:
                logger.info(f"Role: {msg['role']} => {len(str(msg['content']))} chars")
            logger.info("=" * 50)
            
            # Add detailed debug logging of the final messages
            logger.info("DETAILED MESSAGE CONTENT BEING SENT TO MODEL:")
            for i, msg in enumerate(local_messages):
                logger.info(f"Message #{i+1} Role: {msg['role']}")
                if isinstance(msg['content'], str):
                    logger.info(f"Content preview: {msg['content'][:500]}...")
                    if len(msg['content']) > 500:
                        logger.info(f"... (truncated, total length: {len(msg['content'])} chars)")
                else:
                    for j, content_item in enumerate(msg['content']):
                        content_type = content_item.get('type', 'unknown')
                        logger.info(f"  Content part #{j+1} Type: {content_type}")
                        if content_type == 'text':
                            text_content = content_item.get('text', '')
                            logger.info(f"  Text preview: {text_content[:500]}...")
                            if len(text_content) > 500:
                                logger.info(f"  ... (truncated, total length: {len(text_content)} chars)")
                        elif content_type == 'image_url':
                            logger.info(f"  Image URL: {content_item.get('image_url', {}).get('url', 'unknown')}")
            logger.info("=" * 50)

            if provider == "openrouter":
                stream_func = stream_openrouter_completions(
                    model_name=model_name,
                    messages=local_messages,
                    max_tokens=chat_model.max_tokens if chat_model else None,
                    temperature=temperature,
                    start_time=start_time,
                    web_search=chat_data.web
                )
            elif provider == "openai-assistant":
                assistant_id = model_name
                stream_func = stream_openai_assistant_completions(
                    assistant_id=assistant_id,
                    messages=local_messages,
                    thread_id=openai_thread_id,
                    max_tokens=chat_model.max_tokens if chat_model else None,
                    temperature=temperature,
                    start_time=start_time,
                    create_new_thread_if_missing=True,
                    title=None
                )
            elif provider == "openai":
                stream_func = stream_openai_completions(
                    model_name=model_name,  # e.g. "gpt-4", "gpt-3.5-turbo", etc.
                    messages=local_messages,
                    max_tokens=chat_model.max_tokens if chat_model else None,
                    temperature=temperature,
                    start_time=start_time
                )
            else:
                logger.error(f"Unsupported provider: {provider}")
                raise HTTPException(
                    status_code=400, detail=f"Unsupported provider: {provider}"
                )

            # Stream SSE chunks
            async for data_dict in stream_func:
                yield data_dict["sse_chunk"]
                if data_dict["content"]:
                    assistant_response_accumulator.append(data_dict["content"])

            # Memory storage
            final_assistant_content = "".join(assistant_response_accumulator)
            store_assistant_message_in_memory(
                memory, final_assistant_content, chat_data, multi_conversation_id
            )

            end_time = time.time()
            logger.info(
                f"Chat request completed in {end_time - start_time:.2f}s. "
                f"Remaining connections: {active_connections}"
            )

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
