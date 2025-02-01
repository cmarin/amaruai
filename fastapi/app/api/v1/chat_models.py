from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from app import crud, schemas
from app.database import get_db
from app.api.v1.router import create_protected_router

router = create_protected_router(prefix="chat_models", tags=["chat_models"])

@router.post("", response_model=schemas.ChatModel)
def create_chat_model(chat_model: schemas.ChatModelCreate, db: Session = Depends(get_db)):
    return crud.create_chat_model(db=db, chat_model=chat_model)

@router.get("", response_model=List[schemas.ChatModel])
def read_chat_models(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    chat_models = crud.get_chat_models(db, skip=skip, limit=limit)
    return chat_models

@router.get("/{chat_model_id}", response_model=schemas.ChatModel)
def read_chat_model(chat_model_id: UUID, db: Session = Depends(get_db)):
    db_chat_model = crud.get_chat_model(db, chat_model_id=chat_model_id)
    if db_chat_model is None:
        raise HTTPException(status_code=404, detail="Chat model not found")
    return db_chat_model

@router.put("/{chat_model_id}", response_model=schemas.ChatModel)
def update_chat_model(
    chat_model_id: UUID,
    chat_model: schemas.ChatModelCreate,
    db: Session = Depends(get_db)
):
    db_chat_model = crud.update_chat_model(db, chat_model_id=chat_model_id, chat_model=chat_model)
    if db_chat_model is None:
        raise HTTPException(status_code=404, detail="Chat model not found")
    return db_chat_model

@router.delete("/{chat_model_id}", response_model=schemas.ChatModel)
def delete_chat_model(chat_model_id: UUID, db: Session = Depends(get_db)):
    db_chat_model = crud.delete_chat_model(db, chat_model_id=chat_model_id)
    if db_chat_model is None:
        raise HTTPException(status_code=404, detail="Chat model not found")
    return db_chat_model