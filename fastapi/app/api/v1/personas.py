from fastapi import Depends, HTTPException, Path
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from app import crud, schemas
from app.database import get_db
from app.api.v1.router import create_protected_router
from app.api.v1.dependencies import get_current_user

# Create a protected router for personas
router = create_protected_router(prefix="personas", tags=["personas"])

@router.post("/", response_model=schemas.Persona)
def create_persona(persona: schemas.PersonaCreate, db: Session = Depends(get_db)):
    """
    Create a new persona with the following fields:
    - role: The role of the persona
    - goal: The goal of the persona
    - backstory: The backstory of the persona
    - allow_delegation: Whether the persona can delegate tasks
    - verbose: Whether the persona is verbose
    - memory: Whether the persona has memory
    - avatar: Optional avatar URL
    - temperature: Optional temperature value (float between 0 and 1)
    - category_ids: Optional list of category IDs
    - tags: Optional list of tag names
    - tools: Optional list of tool IDs
    """
    return crud.create_persona(db=db, persona=persona)

@router.get("/", response_model=List[schemas.Persona])
def read_personas(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    personas = crud.get_personas(db, skip=skip, limit=limit)
    return personas

@router.get("/{persona_id}", response_model=schemas.Persona)
def read_persona(
    persona_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    db_persona = crud.get_persona(db, persona_id=persona_id)
    if db_persona is None:
        raise HTTPException(status_code=404, detail="Persona not found")
    return db_persona

@router.put("/{persona_id}", response_model=schemas.Persona)
def update_persona(
    persona_id: UUID = Path(...),
    persona: schemas.PersonaUpdate = None,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    db_persona = crud.update_persona(db, persona_id=persona_id, persona=persona)
    if db_persona is None:
        raise HTTPException(status_code=404, detail="Persona not found")
    return db_persona

@router.delete("/{persona_id}", response_model=schemas.Persona)
def delete_persona(
    persona_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    db_persona = crud.delete_persona(db, persona_id=persona_id)
    if db_persona is None:
        raise HTTPException(status_code=404, detail="Persona not found")
    return db_persona
