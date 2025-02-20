from fastapi import Depends, HTTPException, Path
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from app import crud, schemas, models
from app.database import get_db
from app.api.v1.router import create_protected_router
from app.api.v1.dependencies import get_current_user_id

# Create a protected router for prompt templates
router = create_protected_router(prefix="prompt_templates", tags=["prompt_templates"])

@router.post("/", response_model=schemas.PromptTemplate)
async def create_prompt_template(
    prompt_template: dict,  # Change to dict to handle raw data
    db: Session = Depends(get_db),
    current_user: UUID = Depends(get_current_user_id),
):
    """
    Create a new prompt template.
    The current user's UUID will be assigned as the creator.
    """
    # Clean the input data before validation
    if "category_ids" in prompt_template:
        prompt_template["category_ids"] = [] if not prompt_template["category_ids"] else [
            cat_id for cat_id in prompt_template["category_ids"] if cat_id and cat_id.strip()
        ]
    
    if "tags" in prompt_template:
        prompt_template["tags"] = [] if not prompt_template["tags"] else [
            tag for tag in prompt_template["tags"] if tag and tag.strip()
        ]
    
    prompt_template["created_by"] = current_user
    
    try:
        # Now validate with Pydantic model
        prompt_template_data = schemas.PromptTemplateCreate(**prompt_template)
        new_template = crud.create_prompt_template(db=db, prompt_template=prompt_template_data)
        return new_template
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[schemas.PromptTemplate])
def read_prompt_templates(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    prompt_templates = crud.get_prompt_templates(db, skip=skip, limit=limit)
    return prompt_templates

@router.get("/favorites", response_model=List[schemas.PromptTemplate])
def get_favorite_prompt_templates(
    db: Session = Depends(get_db),
    current_user: UUID = Depends(get_current_user_id)
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
    db: Session = Depends(get_db),
    current_user: UUID = Depends(get_current_user_id),
):
    """Update a prompt template."""
    db_prompt_template = crud.get_prompt_template(db, prompt_template_id=prompt_template_id)
    if not db_prompt_template:
        raise HTTPException(status_code=404, detail="Prompt template not found")
        
    # Check if user is the creator of the template
    if db_prompt_template.created_by != current_user:
        raise HTTPException(status_code=403, detail="Not authorized to modify this template")
        
    updated_template = crud.update_prompt_template(
        db=db, 
        prompt_template_id=prompt_template_id, 
        prompt_template=prompt_template
    )
    return updated_template

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
    current_user: UUID = Depends(get_current_user_id)
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
    current_user: UUID = Depends(get_current_user_id)
):
    """Remove a prompt template from user's favorites."""
    return crud.toggle_prompt_template_favorite(
        db=db,
        prompt_template_id=prompt_template_id,
        user_id=current_user,
        favorite=False
    )

@router.post("/{prompt_template_id}/unfavorite", response_model=schemas.PromptTemplate)
def unfavorite_prompt_template_post(
    prompt_template_id: UUID,
    db: Session = Depends(get_db),
    current_user: UUID = Depends(get_current_user_id)
):
    """Remove a prompt template from user's favorites (POST method)."""
    return crud.toggle_prompt_template_favorite(
        db=db,
        prompt_template_id=prompt_template_id,
        user_id=current_user,
        favorite=False
    )
