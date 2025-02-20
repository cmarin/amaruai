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

from app.schemas import ChatMessage, Message, FileInfo
from app.api.v1.router import create_protected_router
from app.database import get_db
from app import crud
from app.utils import format_openai_message, log_chat_request

# Import refactored modules from the config folder
from app.config.chat_utils import (
    cleanup_connection,
    active_connections,
    UUIDEncoder,
    process_attached_files,
    process_referenced_knowledge
)

# Memory-related imports
from app.config.memory_utils import (
    ConversationManager,
    store_user_system_messages_in_memory,
    store_assistant_message_in_memory
)

# -- NEW: Import the OpenRouter utility
from app.config.openrouter_utils import stream_openrouter_completions

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
        # Log request details
        log_chat_request(request, None, chat_data.dict())

        # Setup conversation IDs
        conversation_id = str(chat_data.conversation_id or uuid.uuid4())
        multi_conversation_id = str(
            getattr(chat_data, 'multi_conversation_id', None) or conversation_id
        )

        # Attempt to get a memory buffer for this conversation
        try:
            memory = conversation_manager.get_memory_buffer(conversation_id=conversation_id)
        except Exception as e:
            logger.error(f"Failed to initialize memory buffer: {str(e)}")
            memory = None

        # Determine the user messages
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
                system_message = (
                    f"Role: {persona.role}\n"
                    f"Goal: {persona.goal}\n"
                )
                temperature = persona.temperature

        # Determine model
        model_name = "openai/chatgpt-4o-latest"
        chat_model = None
        if chat_data.model_id:
            chat_model = crud.get_chat_model(db, chat_data.model_id)
            if chat_model:
                model_name = chat_model.model

        # This generator function will be returned as a StreamingResponse
        async def event_generator() -> AsyncGenerator[str, None]:
            """
            Streams content from the (now-extracted) OpenRouter utility,
            accumulates partial responses for final memory storage,
            and yields SSE chunks to the client.
            """
            # Build the local messages that will be sent to OpenRouter
            local_messages = messages_list.copy()
            if system_message:
                local_messages.insert(0, {"role": "system", "content": system_message})

            # -- File processing --
            process_attached_files(db, chat_data, local_messages)

            # -- Knowledge referencing (RAG or full content) --
            process_referenced_knowledge(db, chat_data, local_messages, chat_model)

            # Store user and system messages in memory
            store_user_system_messages_in_memory(
                memory, local_messages, chat_data, multi_conversation_id
            )

            # We'll accumulate all partial content from the SSE stream
            assistant_response_accumulator = []

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

            # Call the OpenRouter streaming function
            async for data_dict in stream_openrouter_completions(
                model_name=model_name,
                messages=local_messages,
                max_tokens=chat_model.max_tokens if chat_model else None,
                temperature=temperature if temperature is not None else None,
                start_time=start_time,
                web_search=chat_data.web  # <-- pass the boolean here
            ):
                # data_dict has {"sse_chunk": <str>, "content": <str>}
                # 1) yield the SSE chunk to the client
                yield data_dict["sse_chunk"]
                # 2) accumulate partial text for memory usage
                if data_dict["content"]:
                    assistant_response_accumulator.append(data_dict["content"])

            # Once the stream is complete, store the final assistant message in memory
            final_assistant_content = "".join(assistant_response_accumulator)
            store_assistant_message_in_memory(
                memory, final_assistant_content, chat_data, multi_conversation_id
            )

            end_time = time.time()
            logger.info(
                f"Chat request completed in {end_time - start_time:.2f}s. "
                f"Remaining connections: {active_connections}"
            )

        # Return the streamed response
        return StreamingResponse(event_generator(), media_type="text/event-stream")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
