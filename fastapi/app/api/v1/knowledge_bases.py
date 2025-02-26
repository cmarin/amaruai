from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app import crud, schemas
from app.database import get_db
from app.api.v1.router import create_protected_router
from uuid import UUID
from app.api.v1.dependencies import get_current_user, get_current_user_id

router = create_protected_router(prefix="knowledge_bases", tags=["knowledge_bases"])

@router.post("/", response_model=schemas.KnowledgeBase)
def create_knowledge_base(
    knowledge_base: schemas.KnowledgeBaseCreate, 
    db: Session = Depends(get_db),
    current_user: UUID = Depends(get_current_user_id)
):
    knowledge_base.created_by = current_user
    return crud.create_knowledge_base(db=db, knowledge_base=knowledge_base)

@router.get("/", response_model=List[schemas.KnowledgeBase])
def read_knowledge_bases(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    knowledge_bases = crud.get_knowledge_bases(db, skip=skip, limit=limit)
    return knowledge_bases

@router.get("/{knowledge_base_id}", response_model=schemas.KnowledgeBase)
def read_knowledge_base(knowledge_base_id: UUID, db: Session = Depends(get_db)):
    db_knowledge_base = crud.get_knowledge_base(db, knowledge_base_id=knowledge_base_id)
    if db_knowledge_base is None:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    return db_knowledge_base

@router.put("/{knowledge_base_id}", response_model=schemas.KnowledgeBase)
def update_knowledge_base(knowledge_base_id: UUID, knowledge_base: schemas.KnowledgeBaseUpdate, db: Session = Depends(get_db)):
    db_knowledge_base = crud.update_knowledge_base(db, knowledge_base_id=knowledge_base_id, knowledge_base=knowledge_base)
    if db_knowledge_base is None:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    return db_knowledge_base

@router.delete("/{knowledge_base_id}", response_model=schemas.KnowledgeBase)
def delete_knowledge_base(knowledge_base_id: UUID, db: Session = Depends(get_db)):
    db_knowledge_base = crud.delete_knowledge_base(db, knowledge_base_id=knowledge_base_id)
    if db_knowledge_base is None:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    return db_knowledge_base

@router.post("/{knowledge_base_id}/assets", response_model=schemas.KnowledgeBase)
def add_assets_to_knowledge_base(
    knowledge_base_id: UUID,
    asset_ids: schemas.AssetIds,
    db: Session = Depends(get_db)
):
    """
    Add one or more assets to a knowledge base.
    
    Parameters:
    - knowledge_base_id: UUID of the knowledge base
    - asset_ids: List of asset UUIDs to add
    """
    db_knowledge_base = crud.add_assets_to_knowledge_base(
        db=db,
        knowledge_base_id=knowledge_base_id,
        asset_ids=asset_ids.asset_ids
    )
    if db_knowledge_base is None:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    return db_knowledge_base

@router.delete("/{knowledge_base_id}/assets", response_model=schemas.KnowledgeBase)
def remove_assets_from_knowledge_base(
    knowledge_base_id: UUID,
    asset_ids: schemas.AssetIds,
    db: Session = Depends(get_db)
):
    """
    Remove one or more assets from a knowledge base.
    
    Parameters:
    - knowledge_base_id: UUID of the knowledge base
    - asset_ids: List of asset UUIDs to remove
    """
    db_knowledge_base = crud.remove_assets_from_knowledge_base(
        db=db,
        knowledge_base_id=knowledge_base_id,
        asset_ids=asset_ids.asset_ids
    )
    if db_knowledge_base is None:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    return db_knowledge_base

@router.get("/{knowledge_base_id}/assets", response_model=List[schemas.Asset])
def get_knowledge_base_assets(
    knowledge_base_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Get all assets associated with a specific knowledge base.
    
    Parameters:
    - knowledge_base_id: UUID of the knowledge base
    """
    db_knowledge_base = crud.get_knowledge_base(db, knowledge_base_id=knowledge_base_id)
    if db_knowledge_base is None:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    return db_knowledge_base.assets 