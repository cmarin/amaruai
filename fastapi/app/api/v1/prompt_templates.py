from fastapi import Depends, HTTPException, Path, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from typing import List, Optional
from uuid import UUID
from enum import Enum
from app import crud, schemas, models
from app.database import get_db
from app.api.v1.router import create_protected_router
from app.api.v1.dependencies import get_current_user_id

class SortField(str, Enum):
    CREATED_AT = "created_at"
    UPDATED_AT = "updated_at"
    TITLE = "title"

class SortOrder(str, Enum):
    ASC = "asc"
    DESC = "desc"

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

# @router.get("/", response_model=List[schemas.PromptTemplate])
# def read_prompt_templates(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
#     prompt_templates = crud.get_prompt_templates(db, skip=skip, limit=limit)
#     return prompt_templates

@router.get("/", response_model=List[schemas.PromptTemplateResponse])
def read_prompt_templates(
    skip: int = 0,
    limit: int = 100,
    sort_by: Optional[SortField] = Query(None, description="Field to sort by"),
    sort_order: Optional[SortOrder] = Query(SortOrder.DESC, description="Sort order"),
    created_by: Optional[UUID] = Query(None, description="Filter by creator's user ID"),
    favorited_by: Optional[UUID] = Query(None, description="Filter by user who favorited"),
    has_favorites: Optional[bool] = Query(None, description="Filter prompts that have been favorited by any user"),
    db: Session = Depends(get_db),
    current_user: UUID = Depends(get_current_user_id)
):
    """
    Get prompt templates with sorting and filtering options.
    
    Parameters:
    - skip: Number of records to skip (pagination)
    - limit: Maximum number of records to return
    - sort_by: Field to sort by (created_at, updated_at, or title)
    - sort_order: Sort order (asc or desc)
    - created_by: Filter by creator's user ID
    - favorited_by: Filter by user who favorited
    - has_favorites: Filter prompts that have been favorited by any user
    """
    try:
        # Start with base query
        query = db.query(models.PromptTemplate)

        # Apply filters
        if created_by:
            query = query.filter(models.PromptTemplate.created_by == created_by)

        if favorited_by:
            query = query.join(
                models.prompt_template_favorites
            ).filter(
                models.prompt_template_favorites.c.user_id == favorited_by
            )

        if has_favorites is not None:
            if has_favorites:
                query = query.join(
                    models.prompt_template_favorites
                ).group_by(
                    models.PromptTemplate.id
                ).having(
                    func.count(models.prompt_template_favorites.c.user_id) > 0
                )
            else:
                # Subquery to find templates with favorites
                favorited = db.query(
                    models.prompt_template_favorites.c.prompt_template_id
                ).distinct().subquery()
                
                # Filter for templates not in the favorited subquery
                query = query.filter(
                    models.PromptTemplate.id.notin_(favorited)
                )

        # Apply sorting
        if sort_by:
            sort_column = getattr(models.PromptTemplate, sort_by.value)
            if sort_order == SortOrder.DESC:
                query = query.order_by(desc(sort_column))
            else:
                query = query.order_by(asc(sort_column))
        else:
            # Default sort by created_at desc
            query = query.order_by(desc(models.PromptTemplate.created_at))

        # Apply pagination
        prompt_templates = query.offset(skip).limit(limit).all()

        # Add is_favorited flag for current user
        for template in prompt_templates:
            is_favorited = db.query(models.prompt_template_favorites).filter(
                models.prompt_template_favorites.c.prompt_template_id == template.id,
                models.prompt_template_favorites.c.user_id == current_user
            ).first() is not None
            setattr(template, 'is_favorited', is_favorited)

        return prompt_templates

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving prompt templates: {str(e)}"
        )

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