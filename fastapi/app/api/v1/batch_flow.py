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
from pydantic import BaseModel, ValidationError
from sqlalchemy.orm import Session

from app.api.v1.router import create_protected_router
from app.utils import format_openai_message, log_chat_request
from app.database import get_db
from app import crud
from app.config.rag_utils import get_optimized_reference_content
from app.schemas import BatchFlowStep, BatchFlowPayload, FileInfo, ChatMessage
from app.config.chat_utils import process_attached_files, process_referenced_knowledge, UUIDEncoder
from app.config.openrouter_utils import stream_openrouter_completions
from app.config.openai_assistant_utils import stream_openai_assistant_completions
from app.config.openai_utils import stream_openai_completions
from app.config.asset_utils import resolve_file_url_to_asset

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
    Process a batch flow request with support for knowledge bases and assets:
      - We retrieve a prompt template by ID
      - We optionally retrieve a persona by ID
      - We retrieve referenced knowledge bases and assets
      - We retrieve file assets by ID
      - We build a single prompt combining all content while respecting token limits
      - We send that prompt to the LLM (via OpenRouter) and stream back the response
    """
    try:
        # Log raw request first
        raw_body = await request.body()
        try:
            raw_json = json.loads(raw_body)
            logger.info("Raw request JSON:")
            logger.info(json.dumps(raw_json, indent=2, cls=UUIDEncoder))
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse raw request JSON: {str(e)}")
            logger.error(f"Raw body: {raw_body.decode()}")
            raise HTTPException(
                status_code=400,
                detail="Invalid JSON in request body"
            )

        # Log validated data
        try:
            validated_data = batch_flow_data.dict()
            logger.info("Validated request data:")
            logger.info(json.dumps(validated_data, indent=2, cls=UUIDEncoder))
        except Exception as e:
            logger.error(f"Error logging validated data: {str(e)}")

        global active_connections
        start_time = time.time()
        active_connections += 1
        background_tasks.add_task(cleanup_connection)

        logger.info(f"New batch flow connection. Active connections: {active_connections}")
        logger.info("=" * 50)
        logger.info(f"REQUEST HEADERS:\n{json.dumps(dict(request.headers), indent=2)}")
        logger.info(f"URL PARAMETERS:\n{json.dumps(dict(request.query_params), indent=2)}")
        logger.info(f"REQUEST BODY:\n{json.dumps(batch_flow_data.dict(), indent=2, cls=UUIDEncoder)}")
        logger.info("=" * 50)

        # ----------------------------------------------------------------
        # For simplicity, we'll handle just the first step in this example.
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

        # Retrieve chat model - use default if none specified
        chat_model = None
        if step.chat_model_id:
            chat_model = crud.get_chat_model(db, step.chat_model_id)
        if not chat_model:
            chat_model = crud.get_default_chat_model(db)
            if not chat_model:
                raise HTTPException(
                    status_code=404,
                    detail="No chat model specified and no default chat model found"
                )

        # Retrieve persona (optional)
        system_message = ""
        persona_temperature = None  # Initialize temperature variable
        if step.persona_id:
            persona = crud.get_persona(db, step.persona_id)
            if persona:
                system_message = (
                    f"Role: {persona.role}\n"
                    f"Goal: {persona.goal}\n"
                )
                # Check if persona has temperature attribute and value
                if hasattr(persona, 'temperature') and persona.temperature is not None:
                    persona_temperature = persona.temperature

        # Build the initial prompt from template and custom instructions
        prompt_parts = [prompt_template.prompt]
        if batch_flow_data.customInstructions:
            prompt_parts.append(batch_flow_data.customInstructions)
        initial_prompt = "\n\n".join(prompt_parts)

        # Create a messages list in the format expected by process_* functions
        local_messages = []
        
        # Determine provider and model early since we need it for message formatting
        provider = "openrouter"  # default
        model_name = chat_model.model
        if chat_model:
            provider = chat_model.provider
            model_name = chat_model.model

        # Handle system message based on provider
        if system_message:
            if provider == "openai-assistant":
                # For OpenAI Assistants, prepend system message to user message
                initial_prompt = f"{system_message}\n\n{initial_prompt}"
            else:
                # For other providers, use proper system message
                local_messages.append({"role": "system", "content": system_message})
        
        # Add user message
        local_messages.append({"role": "user", "content": initial_prompt})

        # Process files and knowledge using existing utilities
        chat_data = ChatMessage(
            message=initial_prompt,
            knowledge_base_ids=batch_flow_data.knowledge_base_ids,
            asset_ids=batch_flow_data.asset_ids
        )

        # Add files if any
        if batch_flow_data.file_ids:
            logger.info(f"Processing {len(batch_flow_data.file_ids)} file IDs")
            files = []
            for asset_id in batch_flow_data.file_ids:
                asset = crud.get_asset(db, asset_id)
                if asset:
                    logger.info(f"Found asset for ID {asset_id}: {asset.file_name} - URL: {asset.file_url}")
                    # Verify the asset URL can be resolved properly
                    result = resolve_file_url_to_asset(db, asset.file_url, asset.file_name)
                    if result:
                        files.append(
                            FileInfo(
                                name=asset.file_name,
                                url=asset.file_url
                            )
                        )
                        logger.info(f"Asset URL resolved successfully for {asset.file_name}")
                    else:
                        logger.warning(f"Asset URL could not be resolved for {asset.file_name}: {asset.file_url}")
                        # Add it anyway, maybe the direct content retrieval will work
                        files.append(
                            FileInfo(
                                name=asset.file_name,
                                url=asset.file_url
                            )
                        )
                else:
                    logger.warning(f"Could not find asset with ID {asset_id}")
            
            chat_data.files = files
            logger.info(f"Added {len(files)} files to chat_data out of {len(batch_flow_data.file_ids)} file IDs")
            
        # Use existing utilities to process files and knowledge
        if chat_data.files:
            process_attached_files(db, chat_data, local_messages)
        if batch_flow_data.knowledge_base_ids or batch_flow_data.asset_ids:
            process_referenced_knowledge(db, chat_data, local_messages, chat_model)

        # Get the final prompt with all content included
        final_user_prompt = local_messages[-1]["content"]

        # -------------------------------------------------------
        # SSE streaming generator
        # -------------------------------------------------------
        async def event_generator() -> AsyncGenerator[str, None]:
            chunks_received = 0
            total_tokens = 0
            stream_start_time = time.time()

            # We'll accumulate the full assistant response in case you want it later
            assistant_response_accumulator = []

            # Select the appropriate streaming function based on provider
            if provider == "openrouter":
                stream_func = stream_openrouter_completions(
                    model_name=model_name,
                    messages=local_messages,
                    max_tokens=chat_model.max_tokens if chat_model else None,
                    temperature=persona_temperature if persona_temperature is not None else 0.7,
                    start_time=start_time,
                    web_search=False  # batch flow doesn't support web search currently
                )
            elif provider == "openai-assistant":
                assistant_id = model_name
                stream_func = stream_openai_assistant_completions(
                    assistant_id=assistant_id,
                    messages=local_messages,
                    thread_id=None,  # batch flow doesn't maintain threads currently
                    max_tokens=chat_model.max_tokens if chat_model else None,
                    temperature=persona_temperature if persona_temperature is not None else 0.7,
                    start_time=start_time,
                    create_new_thread_if_missing=True,
                    title=None
                )
            elif provider == "openai":
                stream_func = stream_openai_completions(
                    model_name=model_name,
                    messages=local_messages,
                    max_tokens=chat_model.max_tokens if chat_model else None,
                    temperature=persona_temperature if persona_temperature is not None else 0.7,
                    start_time=start_time
                )
            else:
                logger.error(f"Unsupported provider: {provider}")
                raise HTTPException(
                    status_code=400, detail=f"Unsupported provider: {provider}"
                )

            # Stream SSE chunks
            async for data_dict in stream_func:
                yield data_dict["sse_chunk"]
                if data_dict["content"]:
                    assistant_response_accumulator.append(data_dict["content"])

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

    except ValidationError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(
            status_code=422,
            detail=f"Invalid request format: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Batch flow error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error processing batch flow request: {str(e)}"
        )
