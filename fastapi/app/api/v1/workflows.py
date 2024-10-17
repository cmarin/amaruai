from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app import crud, schemas, models
from app.database import get_db

router = APIRouter()

@router.post("/workflows/", response_model=schemas.Workflow)
def create_workflow(workflow: schemas.WorkflowCreate, db: Session = Depends(get_db)):
    return crud.create_workflow(db=db, workflow=workflow)

@router.get("/workflows/", response_model=List[schemas.Workflow])
def read_workflows(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    workflows = crud.get_workflows(db, skip=skip, limit=limit)
    return workflows

@router.get("/workflows/{workflow_id}", response_model=schemas.Workflow)
def read_workflow(workflow_id: int, db: Session = Depends(get_db)):
    db_workflow = crud.get_workflow(db, workflow_id=workflow_id)
    if db_workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return db_workflow

@router.put("/workflows/{workflow_id}", response_model=schemas.Workflow)
def update_workflow(workflow_id: int, workflow: schemas.WorkflowUpdate, db: Session = Depends(get_db)):
    db_workflow = crud.update_workflow(db, workflow_id=workflow_id, workflow=workflow)
    if db_workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return db_workflow

@router.delete("/workflows/{workflow_id}", response_model=schemas.Workflow)
def delete_workflow(workflow_id: int, db: Session = Depends(get_db)):
    db_workflow = crud.delete_workflow(db, workflow_id=workflow_id)
    if db_workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return db_workflow

@router.post("/workflows/{workflow_id}/execute", response_model=dict)
def execute_workflow(workflow_id: int, user_input: dict, db: Session = Depends(get_db)):
    try:
        result = crud.execute_workflow(db, workflow_id, user_input)
        return {"result": result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

@router.post("/workflows/{workflow_id}/steps/", response_model=schemas.WorkflowStep)
def create_workflow_step(workflow_id: int, step: schemas.WorkflowStepCreate, db: Session = Depends(get_db)):
    return crud.create_workflow_step(db=db, workflow_id=workflow_id, step=step)

@router.get("/workflows/{workflow_id}/steps/", response_model=List[schemas.WorkflowStep])
def read_workflow_steps(workflow_id: int, db: Session = Depends(get_db)):
    steps = crud.get_workflow_steps(db, workflow_id=workflow_id)
    return steps

@router.put("/workflows/{workflow_id}/steps/{step_id}", response_model=schemas.WorkflowStep)
def update_workflow_step(workflow_id: int, step_id: int, step: schemas.WorkflowStepUpdate, db: Session = Depends(get_db)):
    db_step = crud.update_workflow_step(db, workflow_id=workflow_id, step_id=step_id, step=step)
    if db_step is None:
        raise HTTPException(status_code=404, detail="Workflow step not found")
    return db_step

@router.delete("/workflows/{workflow_id}/steps/{step_id}", response_model=schemas.WorkflowStep)
def delete_workflow_step(workflow_id: int, step_id: int, db: Session = Depends(get_db)):
    db_step = crud.delete_workflow_step(db, workflow_id=workflow_id, step_id=step_id)
    if db_step is None:
        raise HTTPException(status_code=404, detail="Workflow step not found")
    return db_step
