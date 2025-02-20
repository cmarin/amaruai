import os
import logging

from llama_index.storage.chat_store.postgres import PostgresChatStore
from llama_index.core.llms import ChatMessage as LlamaChatMessage, MessageRole
from llama_index.llms.openai import OpenAI
from llama_index.core.memory import ChatSummaryMemoryBuffer

logger = logging.getLogger(__name__)

ASYNC_DATABASE_URL = os.environ.get("ASYNC_DATABASE_URL")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")


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
                chat_store_key=conversation_id,  # unique key for this conversation
                llm=self.llm
            )
        except Exception as e:
            logger.error(f"Error creating memory buffer: {str(e)}", exc_info=True)
            raise


def store_user_system_messages_in_memory(memory, local_messages, chat_data, multi_conversation_id):
    """
    Stores user and system messages into the memory buffer (LLama Index).
    """
    if not memory:
        return

    try:
        for msg in local_messages:
            if msg["role"] == "user":
                user_message = LlamaChatMessage(
                    role=MessageRole.USER,
                    content=msg["content"],
                    additional_kwargs={
                        "user_id": str(chat_data.user_id) if chat_data.user_id else "unknown_user",
                        "multi_conversation_id": str(multi_conversation_id)
                    }
                )
                memory.put(user_message)
            elif msg["role"] == "system":
                system_msg = LlamaChatMessage(
                    role=MessageRole.SYSTEM,
                    content=msg["content"],
                    additional_kwargs={
                        "multi_conversation_id": str(multi_conversation_id)
                    }
                )
                memory.put(system_msg)
    except Exception as e:
        logger.error(f"Failed to store user/system messages in memory: {str(e)}")


def store_assistant_message_in_memory(memory, final_assistant_content, chat_data, multi_conversation_id):
    """
    Stores the assistant's response into the memory buffer (LLama Index).
    """
    if not memory:
        return

    try:
        assistant_message = LlamaChatMessage(
            role=MessageRole.ASSISTANT,
            content=final_assistant_content,
            additional_kwargs={
                "user_id": str(chat_data.user_id) if chat_data.user_id else "unknown_user",
                "multi_conversation_id": str(multi_conversation_id)
            }
        )
        memory.put(assistant_message)
    except Exception as e:
        logger.error(f"Failed to store assistant message in memory: {str(e)}")