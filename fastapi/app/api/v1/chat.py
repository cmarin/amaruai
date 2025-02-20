import os
import json
import uuid
import time
import logging
import aiohttp
from datetime import datetime
from typing import AsyncGenerator, List, Optional, Dict, Any
from dotenv import load_dotenv
from uuid import UUID

from fastapi import FastAPI, Request, HTTPException, BackgroundTasks, Depends
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.schemas import ChatMessage, Message, FileInfo
from app.api.v1.router import create_protected_router
from app.database import get_db
from app import crud
from app.utils import format_openai_message, log_chat_request
from app.config.asset_utils import collect_reference_content
from app.config.rag_utils import get_optimized_reference_content

# Import what we moved to chat_utils
from app.config.chat_utils import (
    ConversationManager,
    cleanup_connection,
    active_connections,
    UUIDEncoder
)

# Set up logging
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

# Create a protected router specifically for chat endpoints
router = create_protected_router(prefix="chat", tags=["chat"])

# Load env vars from .env
load_dotenv()

# We instantiate a single conversation manager instance
conversation_manager = ConversationManager()

@router.post("")
async def chat_endpoint(
    request: Request,
    chat_data: ChatMessage,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Handles chat requests with either a single message or a list of messages.
    """
    try:
        # Log request details using chat_data instead of raw body
        log_chat_request(request, None, chat_data.dict())

        # Setup conversation IDs
        conversation_id = str(chat_data.conversation_id or uuid.uuid4())
        # Use conversation_id as multi_conversation_id if not provided
        multi_conversation_id = str(getattr(chat_data, 'multi_conversation_id', None) or conversation_id)

        # Get a memory buffer for this conversation
        try:
            memory = conversation_manager.get_memory_buffer(conversation_id=conversation_id)
        except Exception as e:
            logger.error(f"Failed to initialize memory buffer: {str(e)}")
            memory = None

        # Handle nested data structure from the frontend
        if hasattr(chat_data, 'data') and chat_data.data:
            if hasattr(chat_data.data, 'messages'):
                messages_list = [m.dict() for m in chat_data.data.messages]
            elif hasattr(chat_data.data, 'message'):
                messages_list = [{"role": "user", "content": chat_data.data.message}]
            else:
                messages_list = [{"role": "user", "content": chat_data.message}]
        # Handle direct message/messages
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

        # Get system message from persona if specified
        system_message = ""
        if chat_data.persona_id:
            persona = crud.get_persona(db, chat_data.persona_id)
            if persona:
                system_message = (
                    f"Role: {persona.role}\n"
                    f"Goal: {persona.goal}\n"
                )

        # Default model name
        model_name = "openai/chatgpt-4o-latest"
        chat_model = None
        if chat_data.model_id:
            chat_model = crud.get_chat_model(db, chat_data.model_id)
            if chat_model:
                model_name = chat_model.model

        # Modify model name if web search is enabled
        if chat_data.web:
            model_name = f"{model_name}:online"
            logger.info(f"Web search enabled. Using model: {model_name}")

        # Load your OpenRouter API Key from ENV
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            logger.error("OpenRouter API key not configured")
            raise HTTPException(status_code=500, detail="OpenRouter API key not configured")

        # Prepare standard headers for openrouter.ai
        headers = {
            "Accept": "text/event-stream",
            "Authorization": f"Bearer {api_key}",
            "HTTP-Referer": "https://chat.example.com",
            "Content-Type": "application/json",
        }

        # Create an async generator to stream the response
        async def event_generator() -> AsyncGenerator[str, None]:
            chunks_received = 0
            total_tokens = 0
            stream_start_time = time.time()

            # Optionally prepend system message
            local_messages = messages_list.copy()
            if system_message:
                local_messages.insert(0, {"role": "system", "content": system_message})

            # Process any attached files
            if chat_data.files:
                logger.info(f"Processing {len(chat_data.files)} files")
                for file in chat_data.files:
                    file_url = file.url.strip(';')
                    try:
                        # Find the index of "chats/" and take everything after it
                        chats_index = file_url.find("chats/")
                        if chats_index == -1:
                            logger.error(
                                f"Invalid file URL format for {file.name}: "
                                f"'chats/' not found in {file_url}"
                            )
                            continue

                        relative_url = file_url[chats_index:]
                        logger.info(f"Processing file: {file.name}")
                        logger.info(f"Full URL: {file_url}")
                        logger.info(f"Relative URL: {relative_url}")

                        asset = crud.get_asset_by_file_url(db, relative_url)
                        if asset:
                            logger.info(f"Found asset in database: {asset.id}")
                            if asset.content:
                                logger.info(
                                    f"Added content from file {file.name} "
                                    f"({len(asset.content)} characters)"
                                )
                            else:
                                logger.warning(
                                    f"No content found in asset {asset.id} "
                                    f"for file {file.name}"
                                )
                        else:
                            logger.warning(
                                f"No asset found for file {file.name} "
                                f"with relative URL {relative_url}"
                            )
                    except Exception as e:
                        logger.error(
                            f"Error processing file {file.name}: {str(e)}",
                            exc_info=True
                        )
                        continue

                # Append image attachments to the last user message by adding structured image parts
                for file in chat_data.files:
                    filename = file.name.lower()
                    # Check if file is an image based on extension
                    if any(ext in filename for ext in [".png", ".jpg", ".jpeg", ".webp"]):
                        # Locate the last user message
                        for i in range(len(local_messages) - 1, -1, -1):
                            if local_messages[i]["role"] == "user":
                                # If the content is a string, convert to list with existing text
                                if isinstance(local_messages[i]["content"], str):
                                    original_text = local_messages[i]["content"]
                                    local_messages[i]["content"] = [
                                        {"type": "text", "text": original_text}
                                    ]
                                # Append the image content part following the OpenRouter schema
                                local_messages[i]["content"].append({
                                    "type": "image_url",
                                    "image_url": {
                                        "url": file.url,
                                        "detail": "auto"
                                    }
                                })
                                logger.info(f"Appended image {file.name} to last user message")
                                break

            # Process referenced knowledge bases and assets with optimization
            if chat_data.knowledge_base_ids or chat_data.asset_ids:
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
                            local_messages[i]["content"] += (
                                "\n\nReferenced Content:" + reference_content
                            )
                            strategy = "RAG" if used_rag else "full content"
                            logger.info(
                                f"Added referenced content using {strategy} strategy "
                                f"with {content_tokens} tokens"
                            )
                            break

            # Put user messages into memory
            if memory:
                try:
                    from llama_index.core.llms import ChatMessage as LlamaChatMessage, MessageRole
                    for msg in local_messages:
                        if msg["role"] == "user":
                            user_message = LlamaChatMessage(
                                role=MessageRole.USER,
                                content=msg["content"],
                                additional_kwargs={
                                    "user_id": str(chat_data.user_id) if chat_data.user_id else "unknown_user",
                                    "multi_conversation_id": str(multi_conversation_id)
                                }
                            )
                            memory.put(user_message)
                        elif msg["role"] == "system":
                            system_msg = LlamaChatMessage(
                                role=MessageRole.SYSTEM,
                                content=msg["content"],
                                additional_kwargs={
                                    "multi_conversation_id": str(multi_conversation_id)
                                }
                            )
                            memory.put(system_msg)
                except Exception as e:
                    logger.error(f"Failed to store messages in memory: {str(e)}")

            assistant_response_accumulator = []

            # Make request to OpenRouter
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json={
                        "model": model_name,
                        "stream": True,
                        "messages": local_messages,
                        "max_tokens": chat_model.max_tokens if chat_model else None
                    },
                ) as resp:
                    api_response_time = time.time() - start_time
                    logger.info(
                        f"OpenRouter API response received in {api_response_time:.2f}s "
                        f"- Status: {resp.status}"
                    )

                    # Log the final message structure being sent
                    logger.info("=" * 50)
                    logger.info("Final message structure sent to OpenRouter:")
                    logger.info(f"Model: {model_name}")
                    logger.info("Messages:")
                    for msg in local_messages:
                        logger.info(f"Role: {msg['role']}")
                        logger.info(f"Content length: {len(msg['content'])} characters")
                        logger.info("-" * 30)
                    logger.info("=" * 50)

                    if resp.status != 200:
                        error_detail = f"Error from OpenRouter API: {resp.status}"
                        logger.error(error_detail)
                        logger.error(f"Response text: {await resp.text()}")
                        raise HTTPException(status_code=resp.status, detail=error_detail)

                    # Read the response line by line (SSE)
                    async for line_bytes in resp.content:
                        line = line_bytes.decode("utf-8", errors="replace").strip()

                        if not line:
                            continue

                        if line.startswith("data: "):
                            data_str = line[len("data: "):].strip()
                            if data_str == "[DONE]":
                                # End of stream
                                break
                            else:
                                # Parse JSON and forward the content as SSE
                                try:
                                    data = json.loads(data_str)
                                    if "choices" in data and data["choices"]:
                                        delta = data["choices"][0].get("delta", {})
                                        content = delta.get("content", "")
                                        # Accumulate for final memory storage
                                        assistant_response_accumulator.append(content)

                                        total_tokens += len(content.split())
                                        yield f"data: {json.dumps(data)}\n\n"
                                    else:
                                        # If the data is not in the expected format, wrap it:
                                        content = data.get("content", "")
                                        assistant_response_accumulator.append(content)

                                        total_tokens += len(content.split())
                                        formatted_data = format_openai_message(content)
                                        yield f"data: {json.dumps(formatted_data)}\n\n"

                                    chunks_received += 1
                                    if chunks_received % 10 == 0:
                                        stream_duration = time.time() - stream_start_time
                                        logger.debug(
                                            f"Stream progress - "
                                            f"Chunks: {chunks_received}, "
                                            f"Tokens: {total_tokens}, "
                                            f"Duration: {stream_duration:.2f}s"
                                        )

                                except json.JSONDecodeError:
                                    logger.error(
                                        f"Failed to parse SSE data: {data_str}",
                                        exc_info=True
                                    )
                                except Exception as e:
                                    logger.error("Error processing event", exc_info=True)
                                    # Optionally send an error message down the stream
                                    error_data = format_openai_message(f"Error: {str(e)}")
                                    yield f"data: {json.dumps(error_data)}\n\n"

                logger.info(
                    f"Stream completed - "
                    f"Total chunks: {chunks_received}, Total tokens: {total_tokens}"
                )

            # Put assistant message into memory
            if memory:
                final_assistant_content = "".join(assistant_response_accumulator)
                assistant_message = LlamaChatMessage(
                    role=MessageRole.ASSISTANT,
                    content=final_assistant_content,
                    additional_kwargs={
                        "user_id": str(chat_data.user_id) if chat_data.user_id else "unknown_user",
                        "multi_conversation_id": str(multi_conversation_id)
                    }
                )
                try:
                    memory.put(assistant_message)
                except Exception as e:
                    logger.error(f"Failed to store assistant message in memory: {str(e)}")

            end_time = time.time()
            logger.info(
                f"Chat request completed in {end_time - start_time:.2f}s. Remaining connections: {active_connections}",
                extra={
                    "total_chunks": chunks_received,
                    "total_tokens": total_tokens,
                    "active_connections": active_connections,
                },
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

    return StreamingResponse(event_generator(), media_type="text/event-stream")
