import os
import json
import time
import logging
import aiohttp
from typing import Any, Dict, List, Optional, AsyncGenerator
from fastapi import HTTPException

from app.utils import format_openai_message

logger = logging.getLogger(__name__)

async def stream_openrouter_completions(
    model_name: str,
    messages: List[Dict[str, Any]],
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
    start_time: Optional[float] = None,
    web_search: bool = False
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Makes a streaming request to the OpenRouter API and yields parsed pieces of data.

    Args:
        model_name: Base model name (e.g. "openai/chatgpt-4o-latest").
        messages: List of message dicts in OpenAI-compatible format.
        max_tokens: Optional max token limit for the request.
        temperature: Optional float for temperature.
        start_time: Used for logging when we first get an API response.
        web_search: If True, modifies model_name to use OpenRouter's :online search feature.

    Yields:
        A dictionary with two keys:
        {
            "sse_chunk": str,  # The raw SSE line to forward to the client ("data: {...}\n\n")
            "content": str      # Partial content extracted from 'delta' (for storing/concatenating)
        }
        If no partial content is extracted from a particular line, "content" is empty.
    """

    # Append ":online" if web search is enabled for OpenRouter
    if web_search:
        model_name = f"{model_name}:online"
        logger.info(f"Web search enabled. Using model: {model_name}")

    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        logger.error("OpenRouter API key not configured")
        raise HTTPException(status_code=500, detail="OpenRouter API key not configured")

    headers = {
        "Accept": "text/event-stream",
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "https://chat.example.com",
        "Content-Type": "application/json",
    }

    # For logging partial progress
    chunks_received = 0
    total_tokens = 0
    stream_start_time = time.time()

    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json={
                "model": model_name,
                "stream": True,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature
            },
        ) as resp:
            if start_time:
                api_response_time = time.time() - start_time
                logger.info(
                    f"OpenRouter API response received in {api_response_time:.2f}s "
                    f"- Status: {resp.status}"
                )
            else:
                logger.info(f"OpenRouter API response status: {resp.status}")

            if resp.status != 200:
                error_text = await resp.text()
                error_detail = f"Error from OpenRouter API: {resp.status}"
                logger.error(f"{error_detail}. Response text: {error_text}")
                raise HTTPException(status_code=resp.status, detail=error_detail)

            async for line_bytes in resp.content:
                line = line_bytes.decode("utf-8", errors="replace").strip()
                if not line:
                    continue

                if line.startswith("data: "):
                    data_str = line[len("data: "):].strip()

                    if data_str == "[DONE]":
                        break

                    try:
                        data = json.loads(data_str)
                    except json.JSONDecodeError:
                        logger.error(f"Failed to parse SSE data: {data_str}", exc_info=True)
                        # Yield an error-like object or skip
                        yield {
                            "sse_chunk": f"data: {json.dumps({'error': 'Invalid JSON'})}\n\n",
                            "content": ""
                        }
                        continue

                    content_piece = ""
                    if "choices" in data and len(data["choices"]) > 0:
                        delta = data["choices"][0].get("delta", {})
                        content_piece = delta.get("content", "")
                        total_tokens += len(content_piece.split())

                        # Pass the chunk to the client unchanged
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
                            f"Stream progress - Chunks: {chunks_received}, "
                            f"Tokens: {total_tokens}, Duration: {stream_duration:.2f}s"
                        )

                    yield {
                        "sse_chunk": sse_chunk,
                        "content": content_piece
                    }

    logger.info(
        f"OpenRouter stream completed - "
        f"Total chunks: {chunks_received}, Total tokens: {total_tokens}"
    )
