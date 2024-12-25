from openai import AsyncOpenAI
import os
import json
from fastapi import Request
import logging
logger = logging.getLogger(__name__)

def get_openai_client(api_key: str = None):
    return AsyncOpenAI(
        api_key=api_key or os.environ.get("OPENROUTER_API_KEY"),
        base_url=os.environ.get("OPENAI_API_BASE", "https://openrouter.ai/api/v1")
    )

def format_openai_message(content: str, finish_reason: str = None) -> dict:
    """Format message to match OpenAI's chat completion response format."""
    return {
        "choices": [
            {
                "delta": {"content": content},
                "index": 0,
                "finish_reason": finish_reason,
            }
        ],
        "created": None,
        "id": "chat",
        "model": "openai/gpt-4o",
        "object": "chat.completion.chunk",
    }

# app/utils.py

def log_chat_request(request: Request, raw_body: bytes, chat_data_dict: dict):
    logger.info("=" * 50)
    logger.info("Incoming Chat Request")
    logger.info("=" * 50)
    
    try:
        raw_json = json.loads(raw_body)
        logger.info("Raw JSON before Pydantic validation:")
        logger.info(json.dumps(raw_json, indent=2))
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse raw JSON: {str(e)}")
    
    logger.info("Pydantic validated data:")
    logger.info(json.dumps(chat_data_dict, indent=2))
    
    headers = dict(request.headers)
    auth_header = headers.get('authorization', 'NO AUTH HEADER FOUND')
    logger.info(f"Authorization header: {auth_header}")
    logger.info(f"All request headers:\n{json.dumps(headers, indent=2)}")
    logger.info(f"Request URL: {request.url}")
    logger.info(f"Request method: {request.method}")
    logger.info("=" * 50)
