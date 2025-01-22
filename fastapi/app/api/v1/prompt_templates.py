from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from app import crud, schemas, models
from app.database import get_db
from app.api.v1.router import create_protected_router

# Create a protected router for prompt templates
router = create_protected_router(prefix="prompt_templates", tags=["prompt_templates"])

@router.post("/", response_model=schemas.PromptTemplate)
def create_prompt_template(prompt_template: schemas.PromptTemplateCreate, db: Session = Depends(get_db)):
    return crud.create_prompt_template(db=db, prompt_template=prompt_template)

@router.get("/", response_model=List[schemas.PromptTemplate])
def read_prompt_templates(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    prompt_templates = crud.get_prompt_templates(db, skip=skip, limit=limit)
    return prompt_templates

@router.get("/{prompt_template_id}", response_model=schemas.PromptTemplate)
def read_prompt_template(prompt_template_id: UUID, db: Session = Depends(get_db)):
    db_prompt_template = crud.get_prompt_template(db, prompt_template_id=prompt_template_id)
    if db_prompt_template is None:
        raise HTTPException(status_code=404, detail="Prompt template not found")
    return db_prompt_template

@router.put("/{prompt_template_id}", response_model=schemas.PromptTemplate)
def update_prompt_template(
    prompt_template_id: UUID, 
    prompt_template: schemas.PromptTemplateUpdate, 
    db: Session = Depends(get_db)
):
    db_prompt_template = crud.update_prompt_template(db, prompt_template_id=prompt_template_id, prompt_template=prompt_template)
    if db_prompt_template is None:
        raise HTTPException(status_code=404, detail="Prompt template not found")
    return db_prompt_template

@router.delete("/{prompt_template_id}", response_model=schemas.PromptTemplate)
def delete_prompt_template(prompt_template_id: UUID, db: Session = Depends(get_db)):
    db_prompt_template = crud.delete_prompt_template(db, prompt_template_id=prompt_template_id)
    if db_prompt_template is None:
        raise HTTPException(status_code=404, detail="Prompt template not found")
    return db_prompt_template
