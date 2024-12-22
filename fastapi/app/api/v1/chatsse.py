import os
import json
import uuid
import time
import logging
from datetime import datetime
from typing import AsyncGenerator, List, Optional, Dict

import aiohttp
from fastapi import FastAPI, Request, HTTPException, BackgroundTasks, Depends
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.v1.router import create_protected_router
from app import crud
from app.database import get_db

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)


class CorrelationIdFilter(logging.Filter):
    def filter(self, record):
        if not hasattr(record, 'correlation_id'):
            record.correlation_id = 'NO_CORRELATION_ID'
        return True


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
formatter = logging.Formatter(
    '%(asctime)s - %(levelname)s - [%(correlation_id)s] - %(message)s'
)
handler = logging.StreamHandler()
handler.setFormatter(formatter)
logger.handlers = [handler]
logger.addFilter(CorrelationIdFilter())

active_connections = 0

# Create a protected router specifically for chat endpoints
router = create_protected_router(prefix="chatsse", tags=["chat"])

class Message(BaseModel):
    role: str = Field(..., description="The role of the sender (e.g. user, assistant, system)")
    content: str = Field(..., description="The content of the message")

class FileInfo(BaseModel):
    name: str = Field(..., description="Name of the file")
    url: str = Field(..., description="URL of the file")

class ChatMessage(BaseModel):
    # Either a single message or a list of messages
    message: Optional[str] = Field(
        None,
        description="Single message if you're not passing a list of messages"
    )
    messages: Optional[List[Message]] = Field(
        None,
        description="List of chat messages"
    )
    model_id: Optional[int] = Field(None, description="ID of the chat model to use")
    persona_id: Optional[int] = Field(None, description="ID of the persona to use")
    user_id: Optional[str] = Field(None, description="ID of the user")
    files: Optional[List[FileInfo]] = Field(default=[], description="List of files to process")


def format_openai_message(content: str, finish_reason: str = None) -> dict:
    """Format message to match OpenAI's chat completion response format."""
    return {
        "choices": [
            {
                "delta": {"content": content},
                "index": 0,
                "finish_reason": finish_reason,
            }
        ],
        "created": None,
        "id": "chat",
        "model": "openai/gpt-4o",
        "object": "chat.completion.chunk",
    }


async def cleanup_connection(correlation_id: str):
    global active_connections
    active_connections -= 1
    logger.info(
        f"Connection cleanup completed. Remaining connections: {active_connections}",
        extra={"correlation_id": correlation_id},
    )


@router.post("")
async def chat_endpoint(
    chat_data: ChatMessage,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Receives either:
        {
          "message": "tell me a joke"
        }
    OR:
        {
          "messages": [
            {"role": "user", "content": "tell me a joke"}
          ]
        }
    and transforms them to a unified structure for processing.
    """
    logger.info("=" * 50)
    logger.info("Incoming Chat Request")
    logger.info("=" * 50)
    
    # Log headers
    headers = dict(request.headers)
    auth_header = headers.get('authorization', 'NO AUTH HEADER FOUND')
    logger.info(f"Authorization header: {auth_header}")
    logger.info(f"All request headers:\n{json.dumps(headers, indent=2)}")
    
    # Log request URL
    logger.info(f"Request URL: {request.url}")
    logger.info(f"Request method: {request.method}")
    
    # Log request body
    body = await request.body()
    try:
        raw_body = json.loads(body)
        logger.info(f"Request body:\n{json.dumps(raw_body, indent=2)}")
    except:
        logger.info(f"Raw request body (not JSON): {body}")
    
    logger.info("=" * 50)

    # Convert single message to the list-of-messages format if needed
    if chat_data.messages and len(chat_data.messages) > 0:
        messages_list = [m.dict() for m in chat_data.messages]
    elif chat_data.message:
        messages_list = [{"role": "user", "content": chat_data.message}]
    else:
        # If both are missing, handle it as an error or default
        raise HTTPException(status_code=422, detail="No message(s) provided.")
        
    global active_connections
    correlation_id = str(uuid.uuid4())
    start_time = time.time()

    active_connections += 1
    background_tasks.add_task(cleanup_connection, correlation_id)
    logger.info(
        f"New chat connection. Active connections: {active_connections}",
        extra={"correlation_id": correlation_id},
    )
    logger.info("=" * 50, extra={"correlation_id": correlation_id})
    logger.info(
        f"REQUEST HEADERS:\n{json.dumps(dict(request.headers), indent=2)}",
        extra={"correlation_id": correlation_id},
    )
    logger.info(
        f"URL PARAMETERS:\n{json.dumps(dict(request.query_params), indent=2)}",
        extra={"correlation_id": correlation_id},
    )
    # Log the entire request body as received by Pydantic
    logger.info(
        f"REQUEST BODY:\n{json.dumps(chat_data.dict(), indent=2)}",
        extra={"correlation_id": correlation_id},
    )
    logger.info("=" * 50, extra={"correlation_id": correlation_id})

    # Get system message from persona if specified
    system_message = ""
    if chat_data.persona_id:
        persona = crud.get_persona(db, chat_data.persona_id)
        if persona:
            system_message = (
                f"Role: {persona.role}\n"
                f"Goal: {persona.goal}\n"
                f"Backstory: {persona.backstory}"
            )

    # Get the model name
    model_name = "openai/gpt-4o"  # default
    if chat_data.model_id:
        chat_model = crud.get_chat_model(db, chat_data.model_id)
        if chat_model:
            model_name = chat_model.model

    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        logger.error("OpenRouter API key not configured", extra={"correlation_id": correlation_id})
        raise HTTPException(status_code=500, detail="OpenRouter API key not configured")

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
            file_contents = []
            for file in chat_data.files:
                # Extract the relative path from the full URL
                # Example: from "https://...co/storage/v1/object/public/amaruai-dev/chats/user/uuid/file.txt"
                # we want "chats/user/uuid/file.txt"
                file_url = file.url
                try:
                    relative_url = file_url.split("/public/amaruai-dev/")[1]
                    logger.info(f"Looking up asset with relative URL: {relative_url}")
                    
                    asset = crud.get_asset_by_file_url(db, relative_url)
                    if asset and asset.content:
                        file_contents.append(f"\nFile: {file.name}\nContent:\n{asset.content}\n")
                        logger.info(f"Found content for file {file.name}")
                    else:
                        logger.warning(f"No content found for file {file.name} with URL {relative_url}")
                except Exception as e:
                    logger.error(f"Error processing file {file.name}: {str(e)}")
                    continue
        
            if file_contents:
                # Append file contents to the last user message
                for i in range(len(local_messages) - 1, -1, -1):
                    if local_messages[i]["role"] == "user":
                        local_messages[i]["content"] += "\n\nAttached Files:" + "".join(file_contents)
                        logger.info(f"Added content from {len(file_contents)} files to user message")
                        break

        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json={
                    "model": model_name,
                    "stream": True,
                    "messages": local_messages,
                },
            ) as resp:
                api_response_time = time.time() - start_time
                logger.info(
                    f"OpenRouter API response received in {api_response_time:.2f}s - Status: {resp.status}",
                    extra={"correlation_id": correlation_id},
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
                    logger.error(
                        error_detail,
                        extra={
                            "correlation_id": correlation_id,
                            "response_text": await resp.text(),
                        },
                    )
                    raise HTTPException(status_code=resp.status, detail=error_detail)

                # Read the response line by line (SSE)
                async for line_bytes in resp.content:
                    line = line_bytes.decode("utf-8", errors="replace").strip()

                    if not line:
                        continue

                    if line.startswith("data: "):
                        data_str = line[len("data: ") :].strip()
                        if data_str == "[DONE]":
                            # End of stream
                            break
                        else:
                            # Parse JSON and forward the content as SSE
                            try:
                                data = json.loads(data_str)
                                # The data should already be in OpenAI-like format
                                if "choices" in data and data["choices"]:
                                    delta = data["choices"][0].get("delta", {})
                                    content = delta.get("content", "")
                                    total_tokens += len(content.split())
                                    yield f"data: {json.dumps(data)}\n\n"
                                else:
                                    # If the data is not in the expected format, wrap it:
                                    content = data.get("content", "")
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
                                        f"Duration: {stream_duration:.2f}s",
                                        extra={"correlation_id": correlation_id},
                                    )

                            except json.JSONDecodeError as e:
                                logger.error(
                                    f"Failed to parse SSE data: {data_str}",
                                    extra={
                                        "correlation_id": correlation_id,
                                        "error": str(e),
                                    },
                                    exc_info=True,
                                )
                            except Exception as e:
                                logger.error(
                                    "Error processing event",
                                    extra={"correlation_id": correlation_id, "error": str(e)},
                                    exc_info=True,
                                )
                                # Optionally send an error message down the stream
                                error_data = format_openai_message(f"Error: {str(e)}")
                                yield f"data: {json.dumps(error_data)}\n\n"

                logger.info(
                    f"Stream completed - Total chunks: {chunks_received}, Total tokens: {total_tokens}",
                    extra={"correlation_id": correlation_id},
                )

        end_time = time.time()
        logger.info(
            f"Chat request completed in {end_time - start_time:.2f}s. Remaining connections: {active_connections}",
            extra={
                "correlation_id": correlation_id,
                "total_chunks": chunks_received,
                "total_tokens": total_tokens,
                "active_connections": active_connections,
            },
        )

    return StreamingResponse(event_generator(), media_type="text/event-stream")
