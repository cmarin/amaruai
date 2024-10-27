from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app import crud, schemas
from app.database import get_db
from app.api.v1.router import create_protected_router

# Create a protected router for tools
router = create_protected_router(prefix="tools", tags=["tools"])

@router.post("/", response_model=schemas.Tool)
def create_tool(tool: schemas.ToolCreate, db: Session = Depends(get_db)):
    return crud.create_tool(db=db, tool=tool)

@router.get("/", response_model=List[schemas.Tool])
def read_tools(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    tools = crud.get_tools(db, skip=skip, limit=limit)
    return tools

@router.get("/{tool_id}", response_model=schemas.Tool)
def read_tool(tool_id: int, db: Session = Depends(get_db)):
    db_tool = crud.get_tool(db, tool_id=tool_id)
    if db_tool is None:
        raise HTTPException(status_code=404, detail="Tool not found")
    return db_tool

@router.put("/{tool_id}", response_model=schemas.Tool)
def update_tool(tool_id: int, tool: schemas.ToolCreate, db: Session = Depends(get_db)):
    db_tool = crud.update_tool(db, tool_id=tool_id, tool=tool)
    if db_tool is None:
        raise HTTPException(status_code=404, detail="Tool not found")
    return db_tool

@router.delete("/{tool_id}", response_model=schemas.Tool)
def delete_tool(tool_id: int, db: Session = Depends(get_db)):
    db_tool = crud.delete_tool(db, tool_id=tool_id)
    if db_tool is None:
        raise HTTPException(status_code=404, detail="Tool not found")
    return db_tool
