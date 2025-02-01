from fastapi import Depends, HTTPException, Path
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from app import crud, schemas, models
from app.database import get_db
from app.api.v1.router import create_protected_router
from app.api.v1.dependencies import get_current_user

# Create a protected router for prompt templates
router = create_protected_router(prefix="prompt_templates", tags=["prompt_templates"])

@router.post("/", response_model=schemas.PromptTemplate)
def create_prompt_template(
    prompt_template: schemas.PromptTemplateCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """
    Create a new prompt template.
    If the 'created_by' field is missing, we'll automatically
    assign the current user's email.
    """
    if not prompt_template.created_by:
        prompt_template.created_by = current_user  # Populate with current user info

    try:
        new_template = crud.create_prompt_template(db=db, prompt_template=prompt_template)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return new_template

@router.get("/", response_model=List[schemas.PromptTemplate])
def read_prompt_templates(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    prompt_templates = crud.get_prompt_templates(db, skip=skip, limit=limit)
    return prompt_templates

@router.get("/favorites", response_model=List[schemas.PromptTemplate])
def get_favorite_prompt_templates(
    db: Session = Depends(get_db),
    current_user: UUID = Depends(get_current_user)
):
    """Get all prompt templates favorited by the current user."""
    return crud.get_favorite_prompt_templates(db=db, user_id=current_user)

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

@router.post("/{prompt_template_id}/favorite", response_model=schemas.PromptTemplate)
def favorite_prompt_template(
    prompt_template_id: UUID,
    db: Session = Depends(get_db),
    current_user: UUID = Depends(get_current_user)
):
    """Add a prompt template to user's favorites."""
    return crud.toggle_prompt_template_favorite(
        db=db,
        prompt_template_id=prompt_template_id,
        user_id=current_user,
        favorite=True
    )

@router.delete("/{prompt_template_id}/favorite", response_model=schemas.PromptTemplate)
def unfavorite_prompt_template(
    prompt_template_id: UUID,
    db: Session = Depends(get_db),
    current_user: UUID = Depends(get_current_user)
):
    """Remove a prompt template from user's favorites."""
    return crud.toggle_prompt_template_favorite(
        db=db,
        prompt_template_id=prompt_template_id,
        user_id=current_user,
        favorite=False
    )
