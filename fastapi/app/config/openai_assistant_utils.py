import os
import json
import time
import logging
import aiohttp
import asyncio
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
        "OpenAI-Beta": "assistants=v2"
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

    # Create run
    run_endpoint = f"https://api.openai.com/v1/threads/{thread_id}/runs"
    run_body = {
        "assistant_id": assistant_id
    }
    if temperature:
        run_body["temperature"] = temperature

    async with aiohttp.ClientSession() as session:
        # Create the run
        async with session.post(run_endpoint, headers=headers, json=run_body) as resp:
            if resp.status != 200:
                error_text = await resp.text()
                raise HTTPException(
                    status_code=resp.status,
                    detail=f"Failed to create run: {error_text}"
                )
            run_data = await resp.json()
            run_id = run_data["id"]

        # Poll the run status until complete
        while True:
            status_endpoint = f"https://api.openai.com/v1/threads/{thread_id}/runs/{run_id}"
            async with session.get(status_endpoint, headers=headers) as status_resp:
                if status_resp.status != 200:
                    error_text = await status_resp.text()
                    raise HTTPException(
                        status_code=status_resp.status,
                        detail=f"Failed to check run status: {error_text}"
                    )
                status_data = await status_resp.json()
                status = status_data["status"]

                if status == "completed":
                    break
                elif status in ["failed", "cancelled", "expired"]:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Run failed with status: {status}"
                    )
                
                # Wait before polling again
                await asyncio.sleep(1)

        # Get the messages
        messages_endpoint = f"https://api.openai.com/v1/threads/{thread_id}/messages"
        async with session.get(messages_endpoint, headers=headers) as msg_resp:
            if msg_resp.status != 200:
                error_text = await msg_resp.text()
                raise HTTPException(
                    status_code=msg_resp.status,
                    detail=f"Failed to retrieve messages: {error_text}"
                )
            messages_data = await msg_resp.json()
            
            # Get the latest assistant message
            assistant_message = next(
                (msg for msg in messages_data["data"] if msg["role"] == "assistant"),
                None
            )
            
            if not assistant_message:
                raise HTTPException(
                    status_code=500,
                    detail="No assistant response found"
                )

            # Stream the response content in chunks
            content = assistant_message["content"][0]["text"]["value"]
            chunk_size = 100
            for i in range(0, len(content), chunk_size):
                chunk = content[i:i + chunk_size]
                data = {
                    "choices": [{
                        "delta": {"content": chunk},
                        "finish_reason": None if i + chunk_size < len(content) else "stop"
                    }]
                }
                yield {
                    "sse_chunk": f"data: {json.dumps(data)}\n\n",
                    "content": chunk
                }
                await asyncio.sleep(0.02)  # Small delay to simulate streaming

    logger.info(
        f"OpenAI Assistant SSE stream completed - "
        f"Total chunks: {len(content) // chunk_size}, Total tokens: {len(content.split()) if content else 0}"
    )
