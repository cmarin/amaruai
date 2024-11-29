import logging
import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app import crud, models, schemas
from app.database import get_db
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from litellm import completion
from app.api.v1.dependencies import get_current_user
from dotenv import load_dotenv, find_dotenv, get_key
from app.api.v1.router import create_protected_router
from app.config.supabase import supabase

router = create_protected_router(prefix="chat", tags=["chat"])
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

# Store for chat histories
message_store = {}

def get_chat_history(user_id: str, conversation_id: str) -> List[dict]:
    key = (user_id, conversation_id)
    if key not in message_store:
        # Initialize with system message if it exists
        message_store[key] = []
    return message_store[key]

def get_api_key():
    dotenv_path = find_dotenv()
    if dotenv_path:
        load_dotenv(dotenv_path)
    api_key = get_key(dotenv_path, 'OPENROUTER_API_KEY')
    if api_key:
        return api_key
    return os.getenv('OPENROUTER_API_KEY')

class ChatInput(BaseModel):
    user_id: Optional[str] = None
    conversation_id: str
    message: str
    model: Optional[str] = None
    persona_id: Optional[int] = None

@router.post("/")
async def chat_endpoint(
    chat_input: ChatInput,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    logging.info(f"Received chat request: {chat_input}")
    logging.info(f"Authenticated user email: {user.email}")
    logging.info(f"Authenticated user ID: {user.id}")
    
    chat_input.user_id = user.id

    try:
        system_message = ""
        if chat_input.persona_id:
            persona = crud.get_persona(db, chat_input.persona_id)
            if not persona:
                raise HTTPException(status_code=404, detail="Persona not found")
            system_message = f"Role: {persona.role}\nGoal: {persona.goal}\nBackstory: {persona.backstory}"

        if not chat_input.model:
            default_model = crud.get_default_chat_model(db)
            if not default_model:
                raise HTTPException(status_code=404, detail="No default chat model found in database")
            chat_input.model = default_model.model
        else:
            chat_model = crud.get_chat_model_by_model(db, chat_input.model)
            if not chat_model:
                raise HTTPException(status_code=404, detail=f"Chat model '{chat_input.model}' not found in database")

        async def stream_response(model_name: str):
            try:
                messages = get_chat_history(chat_input.user_id, chat_input.conversation_id)
                
                # Add system message at the start if it exists
                if system_message:
                    if not messages or messages[0].get("role") != "system":
                        messages.insert(0, {"role": "system", "content": system_message})
                
                # Add the new user message
                messages.append({"role": "user", "content": chat_input.message})
                
                response = completion(
                    model=f"openrouter/{model_name}",
                    messages=messages,
                    stream=True,
                    temperature=0.6,
                    api_key=get_api_key(),
                    api_base="https://openrouter.ai/api/v1"
                )

                full_response = ""
                for chunk in response:
                    if hasattr(chunk.choices[0], 'delta') and hasattr(chunk.choices[0].delta, 'content'):
                        content = chunk.choices[0].delta.content
                        if content:
                            full_response += content
                            # Simply send the content with a newline
                            yield f"data: {content}\n\n"
                
                # Store the complete response
                messages.append({"role": "assistant", "content": full_response})
                message_store[(chat_input.user_id, chat_input.conversation_id)] = messages
                
                yield "data: [DONE]\n\n"
            except Exception as e:
                logging.error(f"Error during streaming: {str(e)}")
                if "RESOURCE_EXHAUSTED" in str(e):
                    default_model = crud.get_default_chat_model(db)
                    if default_model and default_model.model != model_name:
                        async for response in stream_response(default_model.model):
                            yield response
                    else:
                        yield "data: Error: Quota exceeded. Please try again later.\n\n"
                else:
                    yield f"data: Error: {str(e)}\n\n"

        return StreamingResponse(
            stream_response(chat_input.model),
            media_type="text/event-stream"
        )

    except Exception as e:
        logging.error(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))