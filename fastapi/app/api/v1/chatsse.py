import os
from typing import AsyncGenerator
import json
import requests
import sseclient
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
import time
import uuid
from datetime import datetime
from app.api.v1.router import create_protected_router, create_public_router

# Configure logging with more detailed format
logging.basicConfig(
    level=logging.INFO,  # Changed from DEBUG to reduce noise
    format='%(asctime)s - %(levelname)s - %(message)s',  # Remove correlation_id from base format
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Add correlation ID filter
class CorrelationIdFilter(logging.Filter):
    def filter(self, record):
        if not hasattr(record, 'correlation_id'):
            record.correlation_id = 'NO_CORRELATION_ID'
        return True

# Configure the main application logger separately
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - [%(correlation_id)s] - %(message)s')
handler = logging.StreamHandler()
handler.setFormatter(formatter)
logger.handlers = [handler]  # Replace existing handlers
logger.addFilter(CorrelationIdFilter())

# Configure third-party loggers
urllib3_logger = logging.getLogger('urllib3')
urllib3_logger.setLevel(logging.WARNING)  # Reduce connection pool noise

requests_logger = logging.getLogger('requests')
requests_logger.setLevel(logging.WARNING)  # Reduce request noise

# Create a protected router specifically for chat endpoints
router = create_public_router(prefix="chatsse", tags=["chatsse"])

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
        "created": None,
        "id": "chat",
        "model": "openai/gpt-4o",
        "object": "chat.completion.chunk"
    }

@router.post("")
async def chat_endpoint(message: ChatMessage, request: Request):
    # Generate correlation ID for request tracking
    correlation_id = str(uuid.uuid4())
    start_time = time.time()
    
    # Log the incoming request details with prominent separators
    logger.info(
        "="*50,
        extra={"correlation_id": correlation_id}
    )
    
    # Log request headers
    headers_to_log = {k: v for k, v in request.headers.items()}
    logger.info(
        f"REQUEST HEADERS:\n{json.dumps(headers_to_log, indent=2)}",
        extra={"correlation_id": correlation_id}
    )

    # Log URL parameters
    params = {k: v for k, v in request.query_params.items()}
    logger.info(
        f"URL PARAMETERS:\n{json.dumps(params, indent=2)}",
        extra={"correlation_id": correlation_id}
    )

    # Log request body
    logger.info(
        f"REQUEST BODY:\n{json.dumps({'message': message.message}, indent=2)}",
        extra={"correlation_id": correlation_id}
    )

    logger.info(
        f"CHAT REQUEST: '{message.message}'",
        extra={"correlation_id": correlation_id}
    )

    logger.info(
        "="*50,
        extra={"correlation_id": correlation_id}
    )

    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        logger.error(
            "OpenRouter API key not configured",
            extra={"correlation_id": correlation_id}
        )
        raise HTTPException(status_code=500, detail="OpenRouter API key not configured")

    # Log client information
    client_host = request.client.host if request.client else "unknown"
    logger.debug(
        f"Client info - Host: {client_host}, User-Agent: {request.headers.get('user-agent', 'unknown')}",
        extra={"correlation_id": correlation_id}
    )

    headers = {
        "Accept": "text/event-stream",
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "https://chat.example.com",
        "Content-Type": "application/json"
    }

    try:
        logger.info(
            "Sending request to OpenRouter API",
            extra={"correlation_id": correlation_id}
        )
        
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json={
                "model": "openai/gpt-4o",
                "stream": True,
                "messages": [
                    {"role": "user", "content": message.message}
                ]
            },
            stream=True
        )

        api_response_time = time.time() - start_time
        logger.info(
            f"OpenRouter API response received in {api_response_time:.2f}s - Status: {response.status_code}",
            extra={"correlation_id": correlation_id}
        )

        if response.status_code != 200:
            error_detail = f"Error from OpenRouter API: {response.status_code}"
            logger.error(
                error_detail,
                extra={
                    "correlation_id": correlation_id,
                    "status_code": response.status_code,
                    "response_text": response.text
                }
            )
            raise HTTPException(status_code=response.status_code, detail=error_detail)
    except requests.exceptions.RequestException as e:
        logger.error(
            f"Failed to connect to OpenRouter API: {str(e)}",
            extra={"correlation_id": correlation_id},
            exc_info=True
        )
        raise HTTPException(status_code=503, detail="Failed to connect to OpenRouter API")

    client = sseclient.SSEClient(response)

    async def event_generator() -> AsyncGenerator[str, None]:
        chunks_received = 0
        total_tokens = 0
        
        try:
            logger.info(
                "Starting SSE stream processing",
                extra={"correlation_id": correlation_id}
            )
            
            for event in client.events():
                if event.data != '[DONE]':
                    try:
                        chunks_received += 1
                        data = json.loads(event.data)
                        
                        # If the response is already in OpenAI format
                        if "choices" in data and len(data["choices"]) > 0:
                            if "delta" in data["choices"][0]:
                                content = data["choices"][0].get("delta", {}).get("content", "")
                                total_tokens += len(content.split())
                                yield f"data: {json.dumps(data)}\n\n"
                        # If we need to format the response
                        elif "content" in data:
                            formatted_data = format_openai_message(data["content"])
                            total_tokens += len(data["content"].split())
                            yield f"data: {json.dumps(formatted_data)}\n\n"
                            
                        if chunks_received % 10 == 0:  # Log progress every 10 chunks
                            logger.debug(
                                f"Stream progress - Chunks: {chunks_received}, Tokens: {total_tokens}",
                                extra={"correlation_id": correlation_id}
                            )
                            
                    except json.JSONDecodeError as e:
                        logger.error(
                            f"Failed to parse SSE data: {event.data}",
                            extra={"correlation_id": correlation_id, "error": str(e)},
                            exc_info=True
                        )
                        continue
                    except Exception as e:
                        logger.error(
                            f"Error processing event",
                            extra={"correlation_id": correlation_id, "error": str(e)},
                            exc_info=True
                        )
                        continue
                        
            logger.info(
                f"Stream completed - Total chunks: {chunks_received}, Total tokens: {total_tokens}",
                extra={"correlation_id": correlation_id}
            )
            
        except Exception as e:
            logger.error(
                "Stream error occurred",
                extra={"correlation_id": correlation_id, "error": str(e)},
                exc_info=True
            )
            error_data = format_openai_message(f"Error: {str(e)}")
            yield f"data: {json.dumps(error_data)}\n\n"
        finally:
            if hasattr(response, 'close'):
                response.close()
            if hasattr(client, 'close'):
                client.close()
            
            end_time = time.time()
            logger.info(
                f"Chat request completed in {end_time - start_time:.2f}s",
                extra={
                    "correlation_id": correlation_id,
                    "total_chunks": chunks_received,
                    "total_tokens": total_tokens
                }
            )

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )
