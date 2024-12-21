import os
import json
import uuid
import time
import logging
from datetime import datetime
from typing import AsyncGenerator
from app.api.v1.router import create_protected_router, create_public_router
import aiohttp
from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s',
                    datefmt='%Y-%m-%d %H:%M:%S')


class CorrelationIdFilter(logging.Filter):

    def filter(self, record):
        if not hasattr(record, 'correlation_id'):
            record.correlation_id = 'NO_CORRELATION_ID'
        return True


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
formatter = logging.Formatter(
    '%(asctime)s - %(levelname)s - [%(correlation_id)s] - %(message)s')
handler = logging.StreamHandler()
handler.setFormatter(formatter)
logger.handlers = [handler]
logger.addFilter(CorrelationIdFilter())


active_connections = 0

# Initialize router
router = create_public_router()

class ChatMessage(BaseModel):
    message: str


def format_openai_message(content: str, finish_reason: str = None) -> dict:
    """Format message to match OpenAI's chat completion response format."""
    return {
        "choices": [{
            "delta": {
                "content": content
            },
            "index": 0,
            "finish_reason": finish_reason
        }],
        "created":
        None,
        "id":
        "chat",
        "model":
        "openai/gpt-4o",
        "object":
        "chat.completion.chunk"
    }


async def cleanup_connection(correlation_id: str):
    global active_connections
    active_connections -= 1
    logger.info(
        f"Connection cleanup completed. Remaining connections: {active_connections}",
        extra={"correlation_id": correlation_id})


@router.post("/")
async def chat_endpoint(message: ChatMessage, request: Request,
                        background_tasks: BackgroundTasks):
    global active_connections
    correlation_id = str(uuid.uuid4())
    start_time = time.time()

    active_connections += 1
    background_tasks.add_task(cleanup_connection, correlation_id)
    logger.info(
        f"New chat connection. Active connections: {active_connections}",
        extra={"correlation_id": correlation_id})
    logger.info("=" * 50, extra={"correlation_id": correlation_id})
    logger.info(
        f"REQUEST HEADERS:\n{json.dumps(dict(request.headers), indent=2)}",
        extra={"correlation_id": correlation_id})
    logger.info(
        f"URL PARAMETERS:\n{json.dumps(dict(request.query_params), indent=2)}",
        extra={"correlation_id": correlation_id})
    logger.info(
        f"REQUEST BODY:\n{json.dumps({'message': message.message}, indent=2)}",
        extra={"correlation_id": correlation_id})
    logger.info(f"CHAT REQUEST: '{message.message}'",
                extra={"correlation_id": correlation_id})
    logger.info("=" * 50, extra={"correlation_id": correlation_id})

    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        logger.error("OpenRouter API key not configured",
                     extra={"correlation_id": correlation_id})
        raise HTTPException(status_code=500,
                            detail="OpenRouter API key not configured")

    headers = {
        "Accept": "text/event-stream",
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "https://chat.example.com",
        "Content-Type": "application/json"
    }

    # Create an async generator to stream the response
    async def event_generator() -> AsyncGenerator[str, None]:
        chunks_received = 0
        total_tokens = 0
        stream_start_time = time.time()

        async with aiohttp.ClientSession() as session:
            async with session.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json={
                        "model": "openai/gpt-4o",
                        "stream": True,
                        "messages": [{
                            "role": "user",
                            "content": message.message
                        }]
                    }) as resp:
                api_response_time = time.time() - start_time
                logger.info(
                    f"OpenRouter API response received in {api_response_time:.2f}s - Status: {resp.status}",
                    extra={"correlation_id": correlation_id})

                if resp.status != 200:
                    error_detail = f"Error from OpenRouter API: {resp.status}"
                    logger.error(error_detail,
                                 extra={
                                     "correlation_id": correlation_id,
                                     "response_text": await resp.text()
                                 })
                    raise HTTPException(status_code=resp.status,
                                        detail=error_detail)

                # Read the response line by line
                async for line_bytes in resp.content:
                    line = line_bytes.decode('utf-8', errors='replace').strip()

                    # OpenRouter streaming responses typically come as SSE lines, e.g.:
                    # data: {...}
                    # If line == "data: [DONE]", we stop.
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
                                # The data should already be in OpenAI-like format
                                # If not, adjust as needed
                                if "choices" in data and data["choices"]:
                                    delta = data["choices"][0].get("delta", {})
                                    content = delta.get("content", "")
                                    total_tokens += len(content.split())
                                    yield f"data: {json.dumps(data)}\n\n"
                                else:
                                    # If the data is not in the expected format, wrap it:
                                    content = data.get("content", "")
                                    total_tokens += len(content.split())
                                    formatted_data = format_openai_message(
                                        content)
                                    yield f"data: {json.dumps(formatted_data)}\n\n"

                                chunks_received += 1
                                if chunks_received % 10 == 0:
                                    stream_duration = time.time(
                                    ) - stream_start_time
                                    logger.debug(
                                        f"Stream progress - Chunks: {chunks_received}, Tokens: {total_tokens}, Duration: {stream_duration:.2f}s",
                                        extra={
                                            "correlation_id": correlation_id
                                        })

                            except json.JSONDecodeError as e:
                                logger.error(
                                    f"Failed to parse SSE data: {data_str}",
                                    extra={
                                        "correlation_id": correlation_id,
                                        "error": str(e)
                                    },
                                    exc_info=True)
                            except Exception as e:
                                logger.error(f"Error processing event",
                                             extra={
                                                 "correlation_id":
                                                 correlation_id,
                                                 "error": str(e)
                                             },
                                             exc_info=True)
                                # Optionally send an error message down the stream
                                error_data = format_openai_message(
                                    f"Error: {str(e)}")
                                yield f"data: {json.dumps(error_data)}\n\n"

                logger.info(
                    f"Stream completed - Total chunks: {chunks_received}, Total tokens: {total_tokens}",
                    extra={"correlation_id": correlation_id})

        end_time = time.time()
        logger.info(
            f"Chat request completed in {end_time - start_time:.2f}s. Remaining connections: {active_connections}",
            extra={
                "correlation_id": correlation_id,
                "total_chunks": chunks_received,
                "total_tokens": total_tokens,
                "active_connections": active_connections
            })

    return StreamingResponse(event_generator(), media_type="text/event-stream")