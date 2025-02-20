import json
import logging
import os
from uuid import UUID

from llama_index.storage.chat_store.postgres import PostgresChatStore
from llama_index.core.llms import ChatMessage as LlamaChatMessage, MessageRole
from llama_index.llms.openai import OpenAI
from llama_index.core.memory import ChatSummaryMemoryBuffer

logger = logging.getLogger(__name__)

# Read environment variables (ensure .env is loaded in your main entrypoint, e.g. main.py or chat.py)
ASYNC_DATABASE_URL = os.environ.get("ASYNC_DATABASE_URL")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

class UUIDEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, UUID):
            return str(obj)
        return super().default(obj)

class ConversationManager:
    """
    Manages retrieval/storage of conversation messages using
    LLamaIndex + PostgresChatStore.
    """
    def __init__(self, token_limit: int = 3000):
        if not ASYNC_DATABASE_URL:
            raise ValueError("ASYNC_DATABASE_URL environment variable is not set")
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY environment variable is not set")

        self.llm = OpenAI(api_key=OPENAI_API_KEY)
        self.token_limit = token_limit
        self.db_uri = ASYNC_DATABASE_URL

    def get_memory_buffer(self, conversation_id: str) -> ChatSummaryMemoryBuffer:
        try:
            # Create a new chat store for each request to avoid prepared statement issues
            chat_store = PostgresChatStore.from_uri(uri=self.db_uri)
            return ChatSummaryMemoryBuffer.from_defaults(
                token_limit=self.token_limit,
                chat_store=chat_store,
                chat_store_key=conversation_id,  # the unique key for this conversation
                llm=self.llm
            )
        except Exception as e:
            logger.error(f"Error creating memory buffer: {str(e)}", exc_info=True)
            raise

active_connections = 0

async def cleanup_connection():
    """
    Decrement the active connection count and log remaining connections.
    """
    global active_connections
    active_connections -= 1
    logger.info(f"Connection cleanup completed. Remaining connections: {active_connections}")
