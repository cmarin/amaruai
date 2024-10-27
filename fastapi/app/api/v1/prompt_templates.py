from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app import crud, schemas, models
from app.database import get_db
from app.api.v1.router import create_protected_router

# Create a protected router for prompt templates
router = create_protected_router(prefix="prompt_templates", tags=["prompt_templates"])

@router.post("", response_model=schemas.PromptTemplate)
def create_prompt_template(prompt_template: schemas.PromptTemplateCreate, db: Session = Depends(get_db)):
    db_prompt_template = models.PromptTemplate(
        title=prompt_template.title,
        prompt=prompt_template.prompt,
        is_complex=prompt_template.is_complex,
        default_persona_id=prompt_template.default_persona_id if hasattr(prompt_template, 'default_persona_id') else None
    )
    db.add(db_prompt_template)
    db.commit()
    db.refresh(db_prompt_template)

    # Handle categories and tags if provided
    if hasattr(prompt_template, 'category_ids'):
        for category_id in prompt_template.category_ids:
            category = crud.get_category(db, category_id)
            if category:
                db_prompt_template.categories.append(category)

    if hasattr(prompt_template, 'tag_ids'):
        for tag_id in prompt_template.tag_ids:
            tag = crud.get_tag(db, tag_id)
            if tag:
                db_prompt_template.tags.append(tag)

    if db_prompt_template.categories or db_prompt_template.tags:
        db.commit()

    return db_prompt_template

@router.get("", response_model=List[schemas.PromptTemplate])
def read_prompt_templates(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    prompt_templates = crud.get_prompt_templates(db, skip=skip, limit=limit)
    return prompt_templates

@router.get("/{prompt_template_id}", response_model=schemas.PromptTemplate)
def read_prompt_template(prompt_template_id: int, db: Session = Depends(get_db)):
    db_prompt_template = crud.get_prompt_template(db, prompt_template_id=prompt_template_id)
    if db_prompt_template is None:
        raise HTTPException(status_code=404, detail="Prompt template not found")
    return db_prompt_template

@router.put("/{prompt_template_id}", response_model=schemas.PromptTemplate)
def update_prompt_template(prompt_template_id: int, prompt_template: schemas.PromptTemplateCreate, db: Session = Depends(get_db)):
    db_prompt_template = crud.update_prompt_template(db, prompt_template_id=prompt_template_id, prompt_template=prompt_template)
    if db_prompt_template is None:
        raise HTTPException(status_code=404, detail="Prompt template not found")
    return db_prompt_template

@router.delete("/{prompt_template_id}", response_model=schemas.PromptTemplate)
def delete_prompt_template(prompt_template_id: int, db: Session = Depends(get_db)):
    db_prompt_template = crud.delete_prompt_template(db, prompt_template_id=prompt_template_id)
    if db_prompt_template is None:
        raise HTTPException(status_code=404, detail="Prompt template not found")
    return db_prompt_template
