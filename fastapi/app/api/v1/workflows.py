from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict
from app import crud, schemas, models
from app.database import get_db
from crewai import Agent, Task, Crew
from crewai.process import Process
from langchain_openai import ChatOpenAI
import httpx
import asyncio

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

async def execute_chat(chat_input: Dict[str, str]):
    async with httpx.AsyncClient() as client:
        response = await client.post("http://localhost:8000/api/v1/chat", json=chat_input)
        return response.json()

@router.post("/workflows/{workflow_id}/execute", response_model=Dict[str, str])
async def execute_workflow(workflow_id: int, user_input: Dict[str, str], background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    try:
        workflow = crud.get_workflow(db, workflow_id=workflow_id)
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        async def run_workflow():
            agents = []
            tasks = []
            for step in sorted(workflow.steps, key=lambda x: x.order):
                prompt_template = step.prompt_template
                chat_model = step.chat_model
                persona = step.persona

                llm = ChatOpenAI(
                    model_name=chat_model.model,
                    openai_api_key=chat_model.api_key,
                    temperature=0.7
                )

                agent = Agent(
                    role=persona.role,
                    goal=persona.goal,
                    backstory=persona.backstory,
                    allow_delegation=persona.allow_delegation,
                    verbose=persona.verbose,
                    memory=persona.memory,
                    llm=llm
                )
                agents.append(agent)

                task = Task(
                    description=prompt_template.prompt.format(**user_input),
                    agent=agent,
                    expected_output="Task completion output"
                )
                tasks.append(task)

            # Map the database ProcessType to CrewAI's Process
            process = Process.sequential if workflow.process_type == models.ProcessType.SEQUENTIAL else Process.hierarchical

            crew = Crew(
                agents=agents,
                tasks=tasks,
                process=process,
                verbose=True
            )

            result = crew.kickoff()
            return {"result": result}

        background_tasks.add_task(run_workflow)
        return {"message": "Workflow execution started in the background"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
