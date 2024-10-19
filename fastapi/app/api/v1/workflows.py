from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict
from app import crud, schemas, models
from app.database import get_db
from crewai import Agent, Task, Crew, Process, LLM
import logging
import os
from dotenv import load_dotenv
import asyncio

load_dotenv()  # This loads the variables from .env file

router = APIRouter()

# Global dictionary to store workflow results
workflow_results = {}

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

@router.post("/workflows/{workflow_id}/execute", response_model=Dict[str, str])
async def execute_workflow(workflow_id: int, user_input: Dict[str, str], background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    try:
        workflow = crud.get_workflow(db, workflow_id=workflow_id)
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        async def run_workflow():
            try:
                agents = []
                tasks = []
                for i, step in enumerate(sorted(workflow.steps, key=lambda x: x.order)):
                    prompt_template = step.prompt_template
                    chat_model = step.chat_model
                    persona = step.persona

                    # Dynamically create LLM for each step
                    llm = LLM(
                        model=f"openrouter/{chat_model.model}",
                        api_key=os.environ["OPENROUTER_API_KEY"],
                        base_url=os.environ["OPENROUTER_API_BASE"]
                    )

                    agent = Agent(
                        role=persona.role,
                        goal=persona.goal,
                        backstory=persona.backstory,
                        allow_delegation=persona.allow_delegation,
                        verbose=persona.verbose,
                        llm=llm
                    )
                    agents.append(agent)

                    if i == 0 and "message" in user_input:
                        description = user_input["message"]
                    else:
                        description = prompt_template.prompt.format(**user_input)

                    task = Task(
                        description=description,
                        agent=agent,
                        expected_output="Quality writing"
                    )
                    tasks.append(task)

                process = Process.sequential if workflow.process_type == models.ProcessType.SEQUENTIAL else Process.hierarchical

                crew = Crew(
                    agents=agents,
                    tasks=tasks,
                    process=process,
                    verbose=True  # Set to True for more detailed logging
                )

                results = []
                crew_result = crew.kickoff()
                for i, task in enumerate(tasks):
                    try:
                        task_result = task.output
                        if task_result is None:
                            raise ValueError(f"Task {i+1} output is None")
                        task_raw_output = task_result.raw if hasattr(task_result, 'raw') else str(task_result)
                        results.append({
                            "step": str(i + 1),
                            "prompt": task.description,
                            "response": task_raw_output
                        })
                    except Exception as task_error:
                        logging.error(f"Error processing task {i+1}: {str(task_error)}")
                        results.append({
                            "step": str(i + 1),
                            "prompt": task.description,
                            "response": f"Error: {str(task_error)}"
                        })

                # Add a completion flag to the results
                results.append({"completed": True})
                workflow_results[workflow_id] = results
                logging.info(f"Workflow execution completed: {results}")
                return {"result": "Workflow execution completed"}
            except Exception as e:
                logging.error(f"Error during workflow execution: {str(e)}")
                workflow_results[workflow_id] = [{
                    "step": "Error",
                    "prompt": "Error occurred",
                    "response": str(e)
                }, {"completed": True}]  # Add completion flag even for errors
                return {"result": f"Error during workflow execution: {str(e)}"}

        background_tasks.add_task(run_workflow)
        return {"message": "Workflow execution started in the background"}
    except Exception as e:
        logging.error(f"Error executing workflow: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/workflows/{workflow_id}/results", response_model=List[Dict[str, str]])
async def get_workflow_results(workflow_id: int):
    results = workflow_results.get(workflow_id, [])
    if not results:
        return []
    
    formatted_results = [
        {
            "step": str(result.get("step", "Unknown")),
            "prompt": str(result.get("prompt", "Unknown")),
            "response": str(result.get("response", "No response"))
        }
        for result in results if "completed" not in result
    ]
    
    # Check if the workflow is completed
    if any("completed" in result for result in results):
        formatted_results.append({"completed": "true"})
    
    return formatted_results

@router.post("/workflows/{workflow_id}/steps/", response_model=schemas.WorkflowStep)
def create_workflow_step(workflow_id: int, step: schemas.WorkflowStepCreate, db: Session = Depends(get_db)):
    return crud.create_workflow_step(db=db, workflow_id=workflow_id, step=step)

@router.get("/workflows/{workflow_id}/steps/", response_model=List[schemas.WorkflowStep])
def read_workflow_steps(workflow_id: int, db: Session = Depends(get_db)):
    steps = crud.get_workflow_steps(db, workflow_id=workflow_id)
    return steps

@router.put("/workflows/{workflow_id}/steps/{step_id}", response_model=schemas.WorkflowStep)
def update_workflow_step(workflow_id: int, step_id: int, step: schemas.WorkflowStepUpdate, db: Session = Depends(get_db)):
    db_step = crud.update_workflow_step(db, step_id=step_id, step=step)
    if db_step is None:
        raise HTTPException(status_code=404, detail="Workflow step not found")
    return db_step

@router.delete("/workflows/{workflow_id}/steps/{step_id}", response_model=schemas.WorkflowStep)
def delete_workflow_step(workflow_id: int, step_id: int, db: Session = Depends(get_db)):
    db_step = crud.delete_workflow_step(db, step_id=step_id)
    if db_step is None:
        raise HTTPException(status_code=404, detail="Workflow step not found")
    return db_step
