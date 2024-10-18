from langchain.chat_models import ChatOpenAI, ChatAnthropic
# Import other chat models as needed

def get_llm_model(provider: str, model: str, api_key: str):
    if provider.lower() == "openai":
        return ChatOpenAI(model_name=model, openai_api_key=api_key)
    elif provider.lower() == "anthropic":
        return ChatAnthropic(model=model, anthropic_api_key=api_key)
    # Add more providers as needed
    else:
        raise ValueError(f"Unsupported provider: {provider}")
