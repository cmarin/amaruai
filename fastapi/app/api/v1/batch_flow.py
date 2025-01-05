# batch_flow.py

import os
import json
import uuid
import time
import logging
import aiohttp
from typing import AsyncGenerator, List, Optional
from dotenv import load_dotenv
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.router import create_protected_router
from app.utils import format_openai_message, log_chat_request
from app.database import get_db
from app import crud

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

load_dotenv()

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
if not OPENROUTER_API_KEY:
    raise ValueError("OPENROUTER_API_KEY environment variable is not set")

active_connections = 0

router = create_protected_router(prefix="batch-flow", tags=["batch-flow"])


# ----------------------------------------------------
# Pydantic models for the Batch Flow request
# ----------------------------------------------------
class Step(BaseModel):
    prompt_template_id: str
    chat_model_id: str
    persona_id: Optional[str] = None


class BatchFlowPayload(BaseModel):
    file_ids: List[str]
    steps: List[Step]
    customInstructions: Optional[str] = None


# ----------------------------------------------------
# Utility to decrement active connections after SSE ends
# ----------------------------------------------------
async def cleanup_connection():
    global active_connections
    active_connections -= 1
    logger.info(f"Connection cleanup completed. Remaining connections: {active_connections}")


# ----------------------------------------------------
# Main Batch Flow Endpoint
# ----------------------------------------------------
@router.post("")
async def batch_flow_endpoint(
    request: Request,
    batch_flow_data: BatchFlowPayload,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Process a batch flow request where:
      - We retrieve a prompt template by ID.
      - We optionally retrieve a persona by ID.
      - We retrieve one or more file assets by ID.
      - We build a single prompt from {prompt_template}, {customInstructions}, and each {asset.content}.
      - We send that prompt to the LLM (via OpenRouter) and stream back the response.
    """
    # Log request details
    raw_body = await request.body()
    log_chat_request(request, raw_body, batch_flow_data.dict())

    global active_connections
    start_time = time.time()
    active_connections += 1
    background_tasks.add_task(cleanup_connection)

    logger.info(f"New batch flow connection. Active connections: {active_connections}")
    logger.info("=" * 50)
    logger.info(f"REQUEST HEADERS:\n{json.dumps(dict(request.headers), indent=2)}")
    logger.info(f"URL PARAMETERS:\n{json.dumps(dict(request.query_params), indent=2)}")
    logger.info(f"REQUEST BODY:\n{json.dumps(batch_flow_data.dict(), indent=2)}")
    logger.info("=" * 50)

    # ----------------------------------------------------------------
    # For simplicity, we’ll handle just the first step in this example.
    # You can extend for multiple steps if needed.
    # ----------------------------------------------------------------
    if not batch_flow_data.steps:
        raise HTTPException(status_code=422, detail="No steps provided.")

    step = batch_flow_data.steps[0]

    # Retrieve prompt template
    prompt_template = crud.get_prompt_template(db, step.prompt_template_id)
    if not prompt_template:
        raise HTTPException(
            status_code=404,
            detail=f"PromptTemplate with ID {step.prompt_template_id} not found."
        )

    # Retrieve chat model
    chat_model = crud.get_chat_model(db, step.chat_model_id)
    if not chat_model:
        raise HTTPException(
            status_code=404,
            detail=f"ChatModel with ID {step.chat_model_id} not found."
        )
    model_name = chat_model.model  # e.g. "openai/gpt-4"

    # Retrieve persona (optional)
    system_message = ""
    if step.persona_id:
        persona = crud.get_persona(db, step.persona_id)
        if persona:
            system_message = (
                f"Role: {persona.role}\n"
                f"Goal: {persona.goal}\n"
            )

    # Retrieve file assets by ID
    file_contents = []
    if batch_flow_data.file_ids:
        for file_id in batch_flow_data.file_ids:
            asset = crud.get_asset(db, file_id)
            if asset and asset.content:
                file_contents.append(asset.content)
                logger.info(f"Added content from asset {file_id} ({len(asset.content)} characters)")

    # Construct final user prompt: {prompt_template.prompt}\n{customInstructions}\n{all asset.content}
    final_prompt_parts = [prompt_template.prompt]
    if batch_flow_data.customInstructions:
        final_prompt_parts.append(batch_flow_data.customInstructions)
    for fc in file_contents:
        final_prompt_parts.append(fc)
    final_user_prompt = "\n\n".join(final_prompt_parts)

    # -------------------------------------------------------
    # SSE streaming generator
    # -------------------------------------------------------
    async def event_generator() -> AsyncGenerator[str, None]:
        chunks_received = 0
        total_tokens = 0
        stream_start_time = time.time()

        # Prepare a standard set of messages for the OpenRouter call
        # We'll use a system message for persona (if present), plus one user message
        local_messages = []
        if system_message:
            local_messages.append({"role": "system", "content": system_message})
        local_messages.append({"role": "user", "content": final_user_prompt})

        # Build the request headers
        headers = {
            "Accept": "text/event-stream",
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "HTTP-Referer": "https://chat.example.com",
            "Content-Type": "application/json",
        }

        # We'll accumulate the full assistant response in case you want it later
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
                logger.info(
                    f"OpenRouter API response status: {resp.status}, time: {api_response_time:.2f}s"
                )

                # Log the final message structure
                logger.info("=" * 50)
                logger.info(f"Using model: {model_name}")
                logger.info("Messages sent to LLM:")
                for m in local_messages:
                    logger.info(f"  - Role: {m['role']}, Content length: {len(m['content'])}")
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
                                    assistant_response_accumulator.append(content)
                                    total_tokens += len(content.split())

                                    # Forward the raw JSON chunk
                                    yield f"data: {json.dumps(data)}\n\n"
                                else:
                                    # If the data is not in the expected format, wrap it
                                    content = data.get("content", "")
                                    assistant_response_accumulator.append(content)
                                    total_tokens += len(content.split())
                                    formatted_data = format_openai_message(content)
                                    yield f"data: {json.dumps(formatted_data)}\n\n"

                                chunks_received += 1
                                if chunks_received % 10 == 0:
                                    stream_duration = time.time() - stream_start_time
                                    logger.debug(
                                        f"Stream progress - Chunks: {chunks_received}, "
                                        f"Tokens: {total_tokens}, "
                                        f"Duration: {stream_duration:.2f}s"
                                    )

                            except json.JSONDecodeError as e:
                                logger.error(f"Failed to parse SSE data: {data_str}", exc_info=True)
                            except Exception as e:
                                logger.error("Error processing event", exc_info=True)
                                error_data = format_openai_message(f"Error: {str(e)}")
                                yield f"data: {json.dumps(error_data)}\n\n"

                logger.info(f"Stream completed - Total chunks: {chunks_received}, Total tokens: {total_tokens}")

        end_time = time.time()
        logger.info(
            f"Batch flow request completed in {end_time - start_time:.2f}s. "
            f"Remaining connections: {active_connections}",
            extra={
                "total_chunks": chunks_received,
                "total_tokens": total_tokens,
                "active_connections": active_connections,
            },
        )

    return StreamingResponse(event_generator(), media_type="text/event-stream")
