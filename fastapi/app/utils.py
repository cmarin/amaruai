from langchain.chat_models import ChatOpenAI, ChatAnthropic
# Import other chat models as needed
from openai import AsyncOpenAI
import os

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
