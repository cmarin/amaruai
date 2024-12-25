from llama_index.storage.chat_store.postgres import PostgresChatStore
from llama_index.core.llms import ChatMessage as LlamaChatMessage, MessageRole
from llama_index.llms.openai import OpenAI
from llama_index.core.memory import ChatSummaryMemoryBuffer, ChatMemoryBuffer
import os
import json
import uuid
import time
import logging
from datetime import datetime
from typing import AsyncGenerator, List, Optional, Dict
from dotenv import load_dotenv
from uuid import UUID
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

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
formatter = logging.Formatter(
    '%(asctime)s - %(levelname)s - %(message)s'
)
handler = logging.StreamHandler()
handler.setFormatter(formatter)
logger.handlers = [handler]

active_connections = 0

# Create a protected router specifically for chat endpoints
router = create_protected_router(prefix="chat", tags=["chat"])

# --------------------- Load env vars for memory --------------------- #
load_dotenv()
ASYNC_DATABASE_URL = os.environ.get("ASYNC_DATABASE_URL")
if not ASYNC_DATABASE_URL:
    raise ValueError("ASYNC_DATABASE_URL environment variable is not set")

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable is not set")
# -------------------------------------------------------------------- #


# ---------------------- LLamaIndex ConversationManager ---------------------- #
class ConversationManager:
    """
    Manages retrieval/storage of conversation messages using
    LLamaIndex + PostgresChatStore.
    """
    def __init__(self, token_limit: int = 3000):
        self.llm = OpenAI(api_key=OPENAI_API_KEY)
        self.chat_store = PostgresChatStore.from_uri(uri=ASYNC_DATABASE_URL)
        self.token_limit = token_limit

    def get_memory_buffer(self, conversation_id: str) -> ChatSummaryMemoryBuffer:
        return ChatSummaryMemoryBuffer.from_defaults(
            token_limit=self.token_limit,
            chat_store=self.chat_store,
            chat_store_key=conversation_id,  # the unique key for this conversation
            llm=self.llm
        )
# --------------------------------------------------------------------------- #


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
    files: List[FileInfo] = Field(default_factory=list, description="List of files to process")

    # -------------------- NEW FIELDS FOR MEMORY -------------------- #
    conversation_id: Optional[str] = Field(
        None,
        description="Unique conversation_id (UUID as str) sent by the client"
    )
    multi_conversation_id: Optional[str] = Field(
        None,
        description="Unique multi_conversation_id (UUID as str) sent by the client"
    )
    # --------------------------------------------------------------- #

    class Config:
        json_schema_extra = {
            "example": {
                "messages": [{"role": "user", "content": "Tell me a joke"}],
                "user_id": "user123",
                "files": [{"name": "doc.txt", "url": "https://..."}]
            }
        }

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

async def cleanup_connection():
    global active_connections
    active_connections -= 1
    logger.info(f"Connection cleanup completed. Remaining connections: {active_connections}")


# We instantiate one conversation manager (or you can re-instantiate each time if you prefer)
conversation_manager = ConversationManager()


@router.post("")
async def chat_endpoint(
    request: Request,
    chat_data: ChatMessage,
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

    Now also supports `conversation_id` and `multi_conversation_id` for memory.
    """
    logger.info("=" * 50)
    logger.info("Incoming Chat Request")
    logger.info("=" * 50)
    
    # Log raw request body before Pydantic validation
    raw_body = await request.body()
    try:
        raw_json = json.loads(raw_body)
        logger.info("Raw JSON before Pydantic validation:")
        logger.info(json.dumps(raw_json, indent=2))
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse raw JSON: {str(e)}")
    
    # Log the Pydantic model after validation
    logger.info("Pydantic validated data:")
    logger.info(json.dumps(chat_data.dict(), indent=2))
    
    # Log headers
    headers = dict(request.headers)
    auth_header = headers.get('authorization', 'NO AUTH HEADER FOUND')
    logger.info(f"Authorization header: {auth_header}")
    logger.info(f"All request headers:\n{json.dumps(headers, indent=2)}")
    
    # Log request URL
    logger.info(f"Request URL: {request.url}")
    logger.info(f"Request method: {request.method}")
    
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
    start_time = time.time()

    active_connections += 1
    background_tasks.add_task(cleanup_connection)
    logger.info(f"New chat connection. Active connections: {active_connections}")
    logger.info("=" * 50)
    logger.info(f"REQUEST HEADERS:\n{json.dumps(dict(request.headers), indent=2)}")
    logger.info(f"URL PARAMETERS:\n{json.dumps(dict(request.query_params), indent=2)}")
    logger.info(f"REQUEST BODY:\n{json.dumps(chat_data.dict(), indent=2)}")
    logger.info("=" * 50)

    # Get system message from persona if specified
    system_message = ""
    if chat_data.persona_id:
        persona = crud.get_persona(db, chat_data.persona_id)
        if persona:
            system_message = (
                f"Role: {persona.role}\n"
                f"Goal: {persona.goal}\n"
            )

    # Get the model name
    model_name = "openai/gpt-4o"  # default
    if chat_data.model_id:
        chat_model = crud.get_chat_model(db, chat_data.model_id)
        if chat_model:
            model_name = chat_model.model

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

    # ---------------------- SET UP MEMORY ---------------------- #
    # If the client didn't provide conversation_id, generate one for them
    conversation_id = chat_data.conversation_id or str(uuid.uuid4())
    multi_conversation_id = chat_data.multi_conversation_id or str(uuid.uuid4())

    # Get a memory buffer for this conversation
    memory = conversation_manager.get_memory_buffer(conversation_id=conversation_id)
    # ----------------------------------------------------------- #

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
            logger.info(f"Processing {len(chat_data.files)} files")
            for file in chat_data.files:
                file_url = file.url.strip(';')  # Remove any trailing semicolons
                try:
                    # Find the index of "chats/" and take everything after it
                    chats_index = file_url.find("chats/")
                    if chats_index == -1:
                        logger.error(f"Invalid file URL format for {file.name}: 'chats/' not found in {file_url}")
                        continue
                        
                    relative_url = file_url[chats_index:]
                    logger.info(f"Processing file: {file.name}")
                    logger.info(f"Full URL: {file_url}")
                    logger.info(f"Relative URL: {relative_url}")
                    
                    asset = crud.get_asset_by_file_url(db, relative_url)
                    if asset:
                        logger.info(f"Found asset in database: {asset.id}")
                        if asset.content:
                            file_contents.append(f"\nFile: {file.name}\nContent:\n{asset.content}\n")
                            logger.info(f"Added content from file {file.name} ({len(asset.content)} characters)")
                        else:
                            logger.warning(f"No content found in asset {asset.id} for file {file.name}")
                    else:
                        logger.warning(f"No asset found for file {file.name} with relative URL {relative_url}")
                except Exception as e:
                    logger.error(f"Error processing file {file.name}: {str(e)}", exc_info=True)
                    continue
            
            if file_contents:
                # Append file contents to the last user message
                for i in range(len(local_messages) - 1, -1, -1):
                    if local_messages[i]["role"] == "user":
                        local_messages[i]["content"] += "\n\nAttached Files:" + "".join(file_contents)
                        logger.info(f"Added content from {len(file_contents)} files to user message")
                        break

        # ---------------------- PUT USER MESSAGES INTO MEMORY ---------------------- #
        for msg in local_messages:
            if msg["role"] == "user":
                user_message = LlamaChatMessage(
                    role=MessageRole.USER,
                    content=msg["content"],
                    additional_kwargs={
                        "user_id": chat_data.user_id or "unknown_user",
                        "multi_conversation_id": multi_conversation_id
                    }
                )
                memory.put(user_message)
            elif msg["role"] == "system":
                # Optionally store system messages if you want them in memory
                system_msg = LlamaChatMessage(
                    role=MessageRole.SYSTEM,
                    content=msg["content"],
                    additional_kwargs={
                        "multi_conversation_id": multi_conversation_id
                    }
                )
                memory.put(system_msg)
        # --------------------------------------------------------------------------- #

        assistant_response_accumulator = []

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
                logger.info(f"OpenRouter API response received in {api_response_time:.2f}s - Status: {resp.status}")
                
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
                        data_str = line[len("data: ") :].strip()
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

                            except json.JSONDecodeError as e:
                                logger.error(f"Failed to parse SSE data: {data_str}", exc_info=True)
                            except Exception as e:
                                logger.error("Error processing event", exc_info=True)
                                # Optionally send an error message down the stream
                                error_data = format_openai_message(f"Error: {str(e)}")
                                yield f"data: {json.dumps(error_data)}\n\n"

                logger.info(f"Stream completed - Total chunks: {chunks_received}, Total tokens: {total_tokens}")

        # ---------------------- PUT ASSISTANT MESSAGE INTO MEMORY ---------------------- #
        final_assistant_content = "".join(assistant_response_accumulator)
        assistant_message = LlamaChatMessage(
            role=MessageRole.ASSISTANT,
            content=final_assistant_content,
            additional_kwargs={
                "user_id": chat_data.user_id or "unknown_user",
                "multi_conversation_id": multi_conversation_id
            }
        )
        memory.put(assistant_message)
        # ------------------------------------------------------------------------------- #

        end_time = time.time()
        logger.info(
            f"Chat request completed in {end_time - start_time:.2f}s. Remaining connections: {active_connections}",
            extra={
                "total_chunks": chunks_received,
                "total_tokens": total_tokens,
                "active_connections": active_connections,
            },
        )

    return StreamingResponse(event_generator(), media_type="text/event-stream")
