import os
import logging
from sqlalchemy.orm import Session
from .database import engine, Base
from .models import Persona, Tool, PromptTemplate, Category, Tag, ChatModel

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s',
                    handlers=[
                        logging.FileHandler("seed_log.txt"),
                        logging.StreamHandler()
                    ])
logger = logging.getLogger(__name__)

def get_or_create(session, model_class, **kwargs):
    instance = session.query(model_class).filter_by(**kwargs).first()
    if instance:
        return instance
    else:
        instance = model_class(**kwargs)
        session.add(instance)
        session.commit()
        return instance

def seed_database():
    try:
        # ... (previous code remains unchanged)

        with Session(engine) as session:
            # ... (previous code for categories, tags, personas, and prompt templates remains unchanged)

            # Create chat models
            logger.info("Starting to create chat models...")
            chat_models = []
            chat_model_data = [
                {"name": "Perplexity Llama", "model": "perplexity/llama-3.1-sonar-huge-128k-online", "provider": "openrouter"},
                {"name": "GPT-4o", "model": "openai/chatgpt-4o-latest", "provider": "openrouter"},
                {"name": "Gemini 1.5 Pro", "model": "google/gemini-pro-1.5-exp", "provider": "openrouter"},
                {"name": "Meta Llama 3.1", "model": "meta-llama/llama-3.1-405b-instruct", "provider": "openrouter"},
                {"name": "Claude 3.5 Sonnet", "model": "anthropic/claude-3.5-sonnet", "provider": "openrouter"},
                {"name": "Mixtral 8x22B", "model": "mistralai/mixtral-8x22b-instruct", "provider": "openrouter"},
                {"name": "Mistral Large", "model": "mistralai/mistral-large", "provider": "openrouter"},
                {"name": "Gemini 1.5", "model": "google/gemini-pro-1.5", "provider": "openrouter"},
                {"name": "Zephyr 7B", "model": "huggingfaceh4/zephyr-7b-beta:free", "provider": "openrouter"},
                {"name": "O1 Mini", "model": "openai/o1-mini", "provider": "openrouter"}
            ]
            
            for data in chat_model_data:
                try:
                    chat_model = get_or_create(session, model_class=ChatModel, **data, default=True)
                    chat_models.append(chat_model)
                    logger.info(f"Created chat model: {chat_model.name}")
                except Exception as e:
                    logger.error(f"Error creating chat model {data['name']}: {str(e)}")
            
            logger.info(f"Chat models created: {[cm.name for cm in chat_models]}")

            # Verify chat models in the database
            db_chat_models = session.query(ChatModel).all()
            logger.info(f"Chat models in database: {[cm.name for cm in db_chat_models]}")

            session.commit()
            logger.info("Database seeded successfully!")
    except Exception as e:
        logger.error(f"An error occurred while seeding the database: {str(e)}")

# ... (rest of the code remains unchanged)

if __name__ == "__main__":
    seed_database()
