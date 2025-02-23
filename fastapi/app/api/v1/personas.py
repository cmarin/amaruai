from fastapi import Depends, HTTPException, Path
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from app import crud, schemas
from app.database import get_db
from app.api.v1.router import create_protected_router
from app.api.v1.dependencies import get_current_user, get_current_user_id
from pydantic import ValidationError
import logging

# Set up logger
logger = logging.getLogger(__name__)

# Create a protected router for personas
router = create_protected_router(prefix="personas", tags=["personas"])

@router.post("/", response_model=schemas.Persona)
def create_persona(
    persona: schemas.PersonaCreate, 
    db: Session = Depends(get_db),
    current_user: UUID = Depends(get_current_user_id)
):
    persona.created_by = current_user
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

@router.put("/{persona_id}")
def update_persona(
    persona_id: UUID,
    persona: schemas.PersonaUpdate,
    db: Session = Depends(get_db)
):
    try:
        db_persona = crud.get_persona(db, persona_id)
        if not db_persona:
            raise HTTPException(status_code=404, detail="Persona not found")
        
        updated_persona = crud.update_persona(db, persona_id, persona)
        return updated_persona
    except ValidationError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(
            status_code=422,
            detail={"message": "Validation error", "errors": e.errors()}
        )
    except Exception as e:
        logger.error(f"Error updating persona: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

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