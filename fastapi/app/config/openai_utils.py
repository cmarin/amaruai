import os
import json
import time
import logging
import aiohttp
from typing import Any, Dict, List, Optional, AsyncGenerator
from fastapi import HTTPException

from app.utils import format_openai_message

logger = logging.getLogger(__name__)

async def stream_openai_assistant_completions(
    model_name: str,
    messages: List[Dict[str, Any]],
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
    start_time: Optional[float] = None
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Makes a streaming request to the OpenAI Chat Completion endpoint
    and yields parsed pieces of data in the same SSE-chunk format
    used by openrouter_utils.

    Args:
        model_name: Unique ID for the OpenAI Assistant (e.g., "gpt-4", "gpt-3.5-turbo-0613", etc.).
        messages: List of message dicts in OpenAI-compatible format.
        max_tokens: Optional max token limit for the request.
        temperature: Optional float for temperature.
        start_time: Used for logging how quickly the API starts responding.

    Yields:
        A dictionary with two keys:
        {
            "sse_chunk": str,  # The raw SSE line to forward to the client ("data: {...}\n\n")
            "content": str      # The partial content extracted from the chunk (for memory accumulation)
        }
        If no partial content is extracted from a particular line, "content" will be empty.
    """

    # Retrieve your OpenAI API key from environment variables
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        logger.error("OpenAI API key not configured")
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")

    headers = {
        "Authorization": f"Bearer {openai_api_key}",
        "Content-Type": "application/json",
    }

    # Prepare the request body for OpenAI's ChatCompletion endpoint
    request_json = {
        "model": model_name,
        "messages": messages,
        "stream": True,
    }
    if max_tokens is not None:
        request_json["max_tokens"] = max_tokens
    if temperature is not None:
        request_json["temperature"] = temperature

    chunks_received = 0
    total_tokens = 0
    stream_start_time = time.time()

    # Perform a streaming POST request to the OpenAI ChatCompletion endpoint
    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json=request_json
        ) as resp:
            if start_time:
                api_response_time = time.time() - start_time
                logger.info(
                    f"OpenAI API response started in {api_response_time:.2f}s "
                    f"- Status: {resp.status}"
                )
            else:
                logger.info(f"OpenAI API response status: {resp.status}")

            if resp.status != 200:
                error_text = await resp.text()
                error_detail = f"Error from OpenAI API: {resp.status}"
                logger.error(f"{error_detail}. Response text: {error_text}")
                raise HTTPException(status_code=resp.status, detail=error_detail)

            # Read the streaming response line-by-line
            async for line_bytes in resp.content:
                line = line_bytes.decode("utf-8", errors="replace").strip()
                if not line:
                    continue

                # Each SSE line from OpenAI typically starts with "data: "
                if line.startswith("data: "):
                    data_str = line[len("data: "):].strip()

                    # The stream ends with a "[DONE]" message
                    if data_str == "[DONE]":
                        break

                    try:
                        data = json.loads(data_str)
                    except json.JSONDecodeError:
                        logger.error(f"Failed to parse SSE data: {data_str}", exc_info=True)
                        yield {
                            "sse_chunk": f"data: {json.dumps({'error': 'Invalid JSON'})}\n\n",
                            "content": ""
                        }
                        continue

                    # Expected shape: {"choices": [{"delta":{"content":"..."}}], ...}
                    content_piece = ""
                    if "choices" in data and len(data["choices"]) > 0:
                        delta = data["choices"][0].get("delta", {})
                        content_piece = delta.get("content", "")
                        total_tokens += len(content_piece.split())

                        # Forward the exact SSE chunk to the client
                        sse_chunk = f"data: {json.dumps(data)}\n\n"
                    else:
                        # Fallback for unexpected structure
                        content_piece = data.get("content", "")
                        total_tokens += len(content_piece.split())
                        formatted_data = format_openai_message(content_piece)
                        sse_chunk = f"data: {json.dumps(formatted_data)}\n\n"

                    chunks_received += 1
                    if chunks_received % 10 == 0:
                        stream_duration = time.time() - stream_start_time
                        logger.debug(
                            f"OpenAI Assistant stream progress - "
                            f"Chunks: {chunks_received}, Tokens: {total_tokens}, "
                            f"Duration: {stream_duration:.2f}s"
                        )

                    # Yield both the SSE chunk and the partial content
                    yield {
                        "sse_chunk": sse_chunk,
                        "content": content_piece
                    }

    logger.info(
        f"OpenAI Assistant stream completed - "
        f"Total chunks: {chunks_received}, Total tokens: {total_tokens}"
    )
