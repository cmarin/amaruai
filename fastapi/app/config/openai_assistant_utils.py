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
    assistant_id: str,
    messages: List[Dict[str, Any]],
    thread_id: Optional[str] = None,
    title: Optional[str] = None,
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
    start_time: Optional[float] = None,
    create_new_thread_if_missing: bool = True,
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Streams a response from the OpenAI Assistants Beta endpoints (thread-based).

    Args:
        assistant_id: The unique ID for your OpenAI Assistant (e.g. "asst-123abc").
        messages: List of messages in the "role/content" format.
        thread_id: The thread to continue. If None and create_new_thread_if_missing is True,
                   we'll create a new thread.
        title: Optional thread title for new threads.
        max_tokens: Optional maximum tokens for the generation.
        temperature: Optional temperature for the generation.
        start_time: For logging how quickly the API starts responding.
        create_new_thread_if_missing: If True, and no thread_id is given, we create a new thread.

    Yields:
        A dict of the form:
        {
          "sse_chunk": str,    # The raw SSE line to forward ("data: {...}\n\n")
          "content": str       # The partial chunk of text extracted from the SSE
        }
    """

    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        logger.error("OpenAI API key not configured")
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")

    headers = {
        "Authorization": f"Bearer {openai_api_key}",
        "Content-Type": "application/json",
    }

    # First create a thread if needed
    if not thread_id and create_new_thread_if_missing:
        # Updated endpoint for creating a thread
        thread_endpoint = "https://api.openai.com/v1/threads"
        thread_body = {}
        if title:
            thread_body["metadata"] = {"title": title}
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                thread_endpoint, 
                headers=headers,
                json=thread_body
            ) as thread_resp:
                if thread_resp.status != 200:
                    error_text = await thread_resp.text()
                    raise HTTPException(
                        status_code=thread_resp.status,
                        detail=f"Failed to create thread: {error_text}"
                    )
                thread_data = await thread_resp.json()
                thread_id = thread_data["id"]

    # Add message to thread
    message_endpoint = f"https://api.openai.com/v1/threads/{thread_id}/messages"
    for message in messages:
        message_body = {
            "role": message["role"],
            "content": message["content"]
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(
                message_endpoint,
                headers=headers,
                json=message_body
            ) as msg_resp:
                if msg_resp.status != 200:
                    error_text = await msg_resp.text()
                    raise HTTPException(
                        status_code=msg_resp.status,
                        detail=f"Failed to add message: {error_text}"
                    )

    # Run the assistant
    run_endpoint = f"https://api.openai.com/v1/threads/{thread_id}/runs"
    run_body = {
        "assistant_id": assistant_id,
        "stream": True
    }
    if max_tokens:
        run_body["max_tokens"] = max_tokens
    if temperature:
        run_body["temperature"] = temperature

    chunks_received = 0
    total_tokens = 0
    stream_start_time = time.time()

    async with aiohttp.ClientSession() as session:
        async with session.post(run_endpoint, headers=headers, json=run_body) as resp:
            if start_time:
                api_response_time = time.time() - start_time
                logger.info(
                    f"OpenAI Assistant beta response started in {api_response_time:.2f}s "
                    f"- Status: {resp.status}"
                )
            else:
                logger.info(f"OpenAI Assistant beta response status: {resp.status}")

            if resp.status not in (200, 201):
                error_text = await resp.text()
                error_detail = (
                    f"Error from OpenAI Assistant endpoint: "
                    f"HTTP {resp.status} - {error_text}"
                )
                logger.error(error_detail)
                raise HTTPException(status_code=resp.status, detail=error_detail)

            # Stream the SSE response line by line
            async for line_bytes in resp.content:
                line = line_bytes.decode("utf-8", errors="replace").strip()
                if not line:
                    continue

                # SSE lines typically start with "data:"
                if line.startswith("data: "):
                    data_str = line[len("data: "):].strip()
                    if data_str == "[DONE]":
                        # End of stream
                        break

                    try:
                        data = json.loads(data_str)
                    except json.JSONDecodeError:
                        logger.error(f"Failed to parse SSE data: {data_str}", exc_info=True)
                        # yield an error SSE chunk or continue
                        yield {
                            "sse_chunk": f"data: {json.dumps({'error': 'Invalid JSON chunk'})}\n\n",
                            "content": ""
                        }
                        continue

                    # The typical shape from the Assistants SSE might differ slightly,
                    # but let's assume it's close to the ChatCompletion style:
                    # {"choices": [{"delta": {"content": "partial text..."}}]}
                    content_piece = ""
                    if "choices" in data and data["choices"]:
                        delta = data["choices"][0].get("delta", {})
                        content_piece = delta.get("content", "")
                        total_tokens += len(content_piece.split())
                        # Forward the SSE chunk unchanged
                        sse_chunk = f"data: {json.dumps(data)}\n\n"
                    else:
                        # Fallback if no "choices" found
                        content_piece = data.get("content", "")
                        total_tokens += len(content_piece.split())
                        formatted_data = format_openai_message(content_piece)
                        sse_chunk = f"data: {json.dumps(formatted_data)}\n\n"

                    chunks_received += 1
                    if chunks_received % 10 == 0:
                        elapsed = time.time() - stream_start_time
                        logger.debug(
                            f"OpenAI Assistant SSE progress - Chunks: {chunks_received}, "
                            f"Tokens: {total_tokens}, Elapsed: {elapsed:.2f}s"
                        )

                    yield {
                        "sse_chunk": sse_chunk,
                        "content": content_piece
                    }

    logger.info(
        f"OpenAI Assistant SSE stream completed - "
        f"Total chunks: {chunks_received}, Total tokens: {total_tokens}"
    )
