from openai import AsyncOpenAI
import os
import json
from fastapi import Request
import logging
from uuid import UUID

logger = logging.getLogger(__name__)

def get_openai_client(api_key: str = None):
    return AsyncOpenAI(
        api_key=api_key or os.environ.get("OPENROUTER_API_KEY"),
        base_url=os.environ.get("OPENAI_API_BASE", "https://openrouter.ai/api/v1")
    )

def format_openai_message(content: str) -> dict:
    """Format a message in OpenAI's expected format."""
    return {
        "choices": [
            {
                "delta": {"content": content},
                "finish_reason": None,
                "index": 0
            }
        ],
        "created": 0,
        "id": "chatcmpl-0",
        "model": "gpt-4",
        "object": "chat.completion.chunk"
    }

class UUIDEncoder(json.JSONEncoder):
    """Custom JSON encoder that handles UUID objects."""
    def default(self, obj):
        if isinstance(obj, UUID):
            return str(obj)
        return super().default(obj)

def log_chat_request(request: Request, raw_body: bytes, chat_data_dict: dict):
    """Log details about an incoming chat request."""
    logger.info("=" * 50)
    logger.info("Incoming Chat Request")
    logger.info("=" * 50)
    
    # Log the raw JSON before Pydantic validation
    logger.info("Raw JSON before Pydantic validation:")
    try:
        raw_json = json.loads(raw_body)
        logger.info(json.dumps(raw_json, indent=2))
    except Exception as e:
        logger.error(f"Could not parse raw JSON: {str(e)}")
    
    # Log the Pydantic validated data
    logger.info("Pydantic validated data:")
    try:
        logger.info(json.dumps(chat_data_dict, indent=2, cls=UUIDEncoder))
    except Exception as e:
        logger.error(f"Could not serialize Pydantic data: {str(e)}")
    
    headers = dict(request.headers)
    auth_header = headers.get('authorization', 'NO AUTH HEADER FOUND')
    logger.info(f"Authorization header: {auth_header}")
    logger.info(f"All request headers:\n{json.dumps(headers, indent=2)}")
    logger.info(f"Request URL: {request.url}")
    logger.info(f"Request method: {request.method}")
    logger.info("=" * 50)
