import os
import json
import time
import logging
import openai
from typing import Any, Dict, List, Optional, AsyncGenerator
from fastapi import HTTPException
from typing_extensions import override

logger = logging.getLogger(__name__)

class AssistantEventHandler(openai.AssistantEventHandler):
    def __init__(self):
        super().__init__()
        self.content_buffer = []
        
    @override
    def on_text_created(self, text) -> None:
        """Called when the assistant starts generating a text response."""
        data = {
            "choices": [{
                "delta": {"content": ""},
                "finish_reason": None
            }]
        }
        self.content_buffer.append({
            "sse_chunk": f"data: {json.dumps(data)}\n\n",
            "content": ""
        })
      
    @override
    def on_text_delta(self, delta, snapshot) -> None:
        """Called when a chunk of text is received from the assistant."""
        if delta.value:
            data = {
                "choices": [{
                    "delta": {"content": delta.value},
                    "finish_reason": None
                }]
            }
            self.content_buffer.append({
                "sse_chunk": f"data: {json.dumps(data)}\n\n",
                "content": delta.value
            })
      
    @override
    def on_tool_call_created(self, tool_call) -> None:
        """Called when the assistant starts a tool call."""
        logger.debug(f"Assistant started tool call: {tool_call.type}")
  
    @override
    def on_tool_call_delta(self, delta, snapshot) -> None:
        """Called when there's an update to a tool call."""
        pass

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
    Streams a response from the OpenAI Assistants API using the newer streaming approach.
    
    Args:
        assistant_id: The unique ID for your OpenAI Assistant (e.g. "asst-123abc").
        messages: List of messages in the "role/content" format.
        thread_id: The thread to continue. If None and create_new_thread_if_missing is True,
                   we'll create a new thread.
        title: Optional thread title for new threads.
        max_tokens: Optional maximum tokens (not used in Assistants API).
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
    try:
        # Initialize OpenAI client
        client = openai.Client(
            api_key=os.getenv("OPENAI_API_KEY")
        )

        # Create a new thread if needed
        if not thread_id and create_new_thread_if_missing:
            thread = client.beta.threads.create()
            thread_id = thread.id
            logger.info(f"Created new thread with ID: {thread_id}")

        # Add messages to thread
        for message in messages:
            client.beta.threads.messages.create(
                thread_id=thread_id,
                role=message["role"],
                content=message["content"]
            )

        # Create event handler
        event_handler = AssistantEventHandler()

        # Log start time if provided
        if start_time:
            api_response_time = time.time() - start_time
            logger.info(f"OpenAI Assistant stream starting in {api_response_time:.2f}s")

        # Start streaming run
        with client.beta.threads.runs.stream(
            thread_id=thread_id,
            assistant_id=assistant_id,
            event_handler=event_handler,
        ) as stream:
            stream.until_done()

            # Yield all accumulated chunks
            for chunk in event_handler.content_buffer:
                yield chunk

            # Send final chunk
            final_data = {
                "choices": [{
                    "delta": {"content": ""},
                    "finish_reason": "stop"
                }]
            }
            yield {
                "sse_chunk": f"data: {json.dumps(final_data)}\n\n",
                "content": ""
            }

    except openai.APIError as e:
        logger.error(f"OpenAI API error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Error in assistant stream: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
