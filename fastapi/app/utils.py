from langchain.chat_models import ChatOpenAI, ChatAnthropic
from openai import AsyncOpenAI
import os
import json

def get_llm_model(provider: str, model: str, api_key: str):
    if provider.lower() == "openai":
        return ChatOpenAI(model_name=model, openai_api_key=api_key)
    elif provider.lower() == "anthropic":
        return ChatAnthropic(model=model, anthropic_api_key=api_key)
    # Add more providers as needed
    else:
        raise ValueError(f"Unsupported provider: {provider}")

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