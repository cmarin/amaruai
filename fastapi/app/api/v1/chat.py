import logging
import os
from typing import List, Optional  # Add Optional to the import
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app import crud, models, schemas
from app.database import get_db
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnableWithMessageHistory, ConfigurableFieldSpec
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.messages import BaseMessage, SystemMessage, trim_messages
from dotenv import load_dotenv, find_dotenv, get_key

router = APIRouter()

logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

# Define an in-memory chat message history
class InMemoryHistory(BaseChatMessageHistory):
    def __init__(self):
        self.messages = []

    def add_messages(self, messages: List[BaseMessage]) -> None:
        self.messages.extend(messages)

    def clear(self) -> None:
        self.messages = []

# Store for chat histories
store = {}

def get_session_history(user_id: str, conversation_id: str) -> BaseChatMessageHistory:
    if (user_id, conversation_id) not in store:
        store[(user_id, conversation_id)] = InMemoryHistory()
    return store[(user_id, conversation_id)]

def get_api_key():
    # Try to find and load the .env file
    dotenv_path = find_dotenv()
    if dotenv_path:
        load_dotenv(dotenv_path)
        # Try to get the key from the .env file
        api_key = get_key(dotenv_path, 'OPENROUTER_API_KEY')
        if api_key:
            return api_key
    
    # If .env file is not found or doesn't contain the key, fall back to OS environment
    return os.getenv('OPENROUTER_API_KEY')

def create_chain_with_message_history(model_name: str, system_message: str):
    logging.info(f"Creating chain with model: {model_name} and system message: {system_message}")
    try:
        api_key = get_api_key()
        if not api_key:
            raise ValueError("API key not found in .env file or OS environment variables")
        
        llm = ChatOpenAI(
            model=model_name,
            temperature=0.6,
            openai_api_key=api_key,
            openai_api_base="https://openrouter.ai/api/v1"
        )

        prompt = ChatPromptTemplate.from_messages([
            ("system", system_message),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{input}"),
        ])

        chain = prompt | llm

        trimmer = trim_messages(
            max_tokens=65,
            strategy="last",
            token_counter=llm,
            include_system=True,
            allow_partial=False,
            start_on="human",
        )

        return RunnableWithMessageHistory(
            chain,
            get_session_history=get_session_history,
            input_messages_key="input",
            history_messages_key="history",
            history_factory_config=[
                ConfigurableFieldSpec(
                    id="user_id",
                    annotation=str,
                    name="User ID",
                    description="Unique identifier for the user.",
                    default="",
                    is_shared=True,
                ),
                ConfigurableFieldSpec(
                    id="conversation_id",
                    annotation=str,
                    name="Conversation ID",
                    description="Unique identifier for the conversation.",
                    default="",
                    is_shared=True,
                ),
            ],
        ).with_config({"memory": {"return_messages": trimmer}})
    except Exception as e:
        logging.error(f"Error creating chain: {str(e)}")
        raise

class ChatInput(BaseModel):
    user_id: str
    conversation_id: str
    message: str
    model: Optional[str] = None
    persona_id: Optional[int] = None

@router.post("/chat")
async def chat_endpoint(chat_input: ChatInput, db: Session = Depends(get_db)):
    logging.info(f"Received chat request: {chat_input}")
    try:
        system_message = ""
        if chat_input.persona_id:
            persona = crud.get_persona(db, chat_input.persona_id)
            if not persona:
                raise HTTPException(status_code=404, detail="Persona not found")
            system_message = f"Role: {persona.role}\nGoal: {persona.goal}\nBackstory: {persona.backstory}"
        
        # If no model is provided, use the default model from the database
        if not chat_input.model:
            default_model = crud.get_default_chat_model(db)
            if not default_model:
                raise HTTPException(status_code=404, detail="No default chat model found in database")
            chat_input.model = default_model.model
        else:
            # Check if the specified chat model exists in the database
            chat_model = crud.get_chat_model_by_model(db, chat_input.model)
            if not chat_model:
                raise HTTPException(status_code=404, detail=f"Chat model '{chat_input.model}' not found in database")
        
        logging.info(f"Creating chain with model: {chat_input.model}")
        
        chain_with_message_history = create_chain_with_message_history(chat_input.model, system_message)
        
        async def stream_response():
            config = {"configurable": {"user_id": chat_input.user_id, "conversation_id": chat_input.conversation_id}}
            logging.info(f"Streaming response with config: {config}")
            try:
                for chunk in chain_with_message_history.stream(
                    {"input": chat_input.message},
                    config=config,
                ):
                    logging.debug(f"Streaming chunk: {chunk.content}")
                    # Split the chunk content into lines
                    lines = chunk.content.splitlines()
                    for line in lines:
                        # Ensure each line is prefixed with 'data: '
                        yield f"data: {line}\n"
                    # End of message
                    yield "\n"
                logging.info("Finished streaming response")
                yield "data: [DONE]\n\n"
            except Exception as e:
                logging.error(f"Error during streaming: {str(e)}")
                # Send an error message in SSE format
                yield f"data: Error: {str(e)}\n\n"

        logging.info("Returning StreamingResponse")
        return StreamingResponse(stream_response(), media_type="text/event-stream")
    except Exception as e:
        logging.error(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))