# chat.py

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

# Import the refactored helpers and classes
from app.config.chat_utils import (
    ConversationManager,
    cleanup_connection,
    active_connections,
    UUIDEncoder,
    process_attached_files,
    process_referenced_knowledge,
    store_user_system_messages_in_memory,
    store_assistant_message_in_memory
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

# Instantiate a single conversation manager
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
        multi_conversation_id = str(getattr(chat_data, 'multi_conversation_id', None) or conversation_id)

        # Attempt to get a memory buffer for this conversation
        try:
            memory = conversation_manager.get_memory_buffer(conversation_id=conversation_id)
        except Exception as e:
            logger.error(f"Failed to initialize memory buffer: {str(e)}")
            memory = None

        # Determine message list
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

        # Persona system message
        system_message = ""
        if chat_data.persona_id:
            persona = crud.get_persona(db, chat_data.persona_id)
            if persona:
                system_message = (
                    f"Role: {persona.role}\n"
                    f"Goal: {persona.goal}\n"
                )

        # Determine model
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

            local_messages = messages_list.copy()
            if system_message:
                local_messages.insert(0, {"role": "system", "content": system_message})

            # --- File processing ---
            process_attached_files(db, chat_data, local_messages)

            # --- Knowledge referencing (RAG or full content) ---
            process_referenced_knowledge(db, chat_data, local_messages, chat_model)

            # Store user/system messages into memory (refactored to chat_utils)
            store_user_system_messages_in_memory(
                memory, local_messages, chat_data, multi_conversation_id
            )

            assistant_response_accumulator = []

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

                    # Log the final message structure
                    logger.info("=" * 50)
                    logger.info("Final message structure sent to OpenRouter:")
                    logger.info(f"Model: {model_name}")
                    logger.info("Messages:")
                    for msg in local_messages:
                        logger.info(f"Role: {msg['role']}")
                        logger.info(f"Content length: {len(str(msg['content']))} characters")
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
                                # Parse JSON and forward content as SSE
                                try:
                                    data = json.loads(data_str)
                                    if "choices" in data and data["choices"]:
                                        delta = data["choices"][0].get("delta", {})
                                        content = delta.get("content", "")
                                        # Accumulate
                                        assistant_response_accumulator.append(content)

                                        total_tokens += len(content.split())
                                        yield f"data: {json.dumps(data)}\n\n"
                                    else:
                                        # Fallback
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
                                    error_data = format_openai_message(f"Error: {str(e)}")
                                    yield f"data: {json.dumps(error_data)}\n\n"

                logger.info(
                    f"Stream completed - "
                    f"Total chunks: {chunks_received}, Total tokens: {total_tokens}"
                )

            # Store the final assistant message into memory (refactored to chat_utils)
            final_assistant_content = "".join(assistant_response_accumulator)
            store_assistant_message_in_memory(
                memory, final_assistant_content, chat_data, multi_conversation_id
            )

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
