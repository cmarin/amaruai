from fastapi import Depends, HTTPException, BackgroundTasks, WebSocket, Request
from sqlalchemy.orm import Session
from typing import List, Dict
from app import crud, schemas, models
from app.database import get_db
from app.api.v1.router import create_protected_router, create_public_router
from crewai import Agent, Task, Crew, Process, LLM
import logging
import os
from dotenv import load_dotenv
import asyncio
from sse_starlette.sse import EventSourceResponse
from app.config.crewai_service import crew_service, CrewAIError
import json
load_dotenv()

# Create routers for workflows
router = create_protected_router(prefix="workflows", tags=["workflows"])
public_router = create_public_router(prefix="workflows", tags=["workflows"])

# Global dictionary to store workflow results
workflow_results = {}

logger = logging.getLogger(__name__)

@router.post("/", response_model=schemas.Workflow)
def create_workflow(workflow: schemas.WorkflowCreate, db: Session = Depends(get_db)):
    if workflow.process_type == models.ProcessType.HIERARCHICAL.value:
        if not workflow.manager_chat_model_id or not workflow.manager_persona_id:
            raise HTTPException(status_code=400, detail="Manager chat model and persona IDs are required for hierarchical workflows.")
    return crud.create_workflow(db=db, workflow=workflow)


@router.get("/", response_model=List[schemas.Workflow])
def read_workflows(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    workflows = crud.get_workflows(db, skip=skip, limit=limit)
    return workflows


@router.get("/{workflow_id}", response_model=schemas.Workflow)
def read_workflow(workflow_id: int, db: Session = Depends(get_db)):
    db_workflow = crud.get_workflow(db, workflow_id=workflow_id)
    if db_workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Ensure max_iterations is a valid integer
    if db_workflow.max_iterations is None:
        db_workflow.max_iterations = 1  # Set a default value if None

    return db_workflow


@router.put("/{workflow_id}", response_model=schemas.Workflow)
def update_workflow(workflow_id: int, workflow: schemas.WorkflowUpdate, db: Session = Depends(get_db)):
    if workflow.process_type == models.ProcessType.HIERARCHICAL.value:
        if not workflow.manager_chat_model_id or not workflow.manager_persona_id:
            raise HTTPException(status_code=400, detail="Manager chat model and persona IDs are required for hierarchical workflows.")
    db_workflow = crud.update_workflow(db, workflow_id=workflow_id, workflow=workflow)
    if db_workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return db_workflow


@router.delete("/{workflow_id}", response_model=schemas.Workflow)
def delete_workflow(workflow_id: int, db: Session = Depends(get_db)):
    db_workflow = crud.delete_workflow(db, workflow_id=workflow_id)
    if db_workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return db_workflow


@router.post("/{workflow_id}/execute", response_model=Dict[str, str])
async def execute_workflow(workflow_id: int, user_input: Dict[str, str], background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    try:
        workflow = crud.get_workflow(db, workflow_id=workflow_id)
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        # Determine max_iterations only for hierarchical workflows
        max_iterations = workflow.max_iterations if workflow.process_type == models.ProcessType.HIERARCHICAL.value else None

        async def run_workflow():
            try:
                agents = []
                tasks = []
                manager = None
                manager_llm = None

                # Create manager agent if the workflow is hierarchical
                if workflow.process_type == models.ProcessType.HIERARCHICAL.value:
                    logging.info(f"Manager Chat Model ID: {workflow.manager_chat_model_id}")
                    logging.info(f"Manager Persona ID: {workflow.manager_persona_id}")

                    manager_persona = crud.get_persona(db, workflow.manager_persona_id)
                    manager_chat_model = crud.get_chat_model(db, workflow.manager_chat_model_id)

                    if manager_chat_model:
                        manager_llm = LLM(
                            model=f"openrouter/{manager_chat_model.model}",
                            api_key=os.environ["OPENROUTER_API_KEY"],
                            base_url=os.environ["OPENROUTER_API_BASE"]
                        )
                        logging.info(f"Manager LLM configured with model: {manager_chat_model.model}")
                    else:
                        logging.error("Manager chat model not found or not configured.")

                    if manager_persona:
                        manager = Agent(
                            role=manager_persona.role,
                            goal=manager_persona.goal,
                            backstory=manager_persona.backstory,
                            allow_delegation=manager_persona.allow_delegation,
                            verbose=manager_persona.verbose,
                            llm=manager_llm
                        )
                        logging.info(f"Manager agent configured with role: {manager_persona.role}")
                    else:
                        logging.error("Manager persona not found or not configured.")

                for i, step in enumerate(sorted(workflow.steps, key=lambda x: x.position)):
                    prompt_template = step.prompt_template
                    chat_model = step.chat_model
                    persona = step.persona

                    # Dynamically create LLM for each step
                    llm = LLM(
                        model=f"openrouter/{chat_model.model}",
                        api_key=os.environ["OPENROUTER_API_KEY"],
                        base_url=os.environ["OPENROUTER_API_BASE"]
                    )

                    # Set max_iter only if max_iterations is not None
                    agent = Agent(
                        role=persona.role,
                        goal=persona.goal,
                        backstory=persona.backstory,
                        allow_delegation=persona.allow_delegation,
                        verbose=persona.verbose,
                        llm=llm,
                        max_iter=max_iterations if max_iterations is not None else 1  # Default to 1 if not set
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

                logging.debug(f"Workflow process type: {workflow.process_type}")

                # Check the process type and set the process accordingly
                process = Process.sequential if workflow.process_type == models.ProcessType.SEQUENTIAL.value else Process.hierarchical
                crew = Crew(
                    agents=agents,
                    tasks=tasks,
                    process=process,
                    verbose=True,
                    manager_agent=manager if workflow.process_type == models.ProcessType.HIERARCHICAL.value else None,
                    manager_llm=manager_llm if workflow.process_type == models.ProcessType.HIERARCHICAL.value else None
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


@router.get("/{workflow_id}/results", response_model=List[Dict[str, str]])
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


@router.post("/{workflow_id}/steps/", response_model=schemas.WorkflowStep)
def create_workflow_step(workflow_id: int, step: schemas.WorkflowStepCreate, db: Session = Depends(get_db)):
    # Create a new WorkflowStepCreate instance without position
    step_data = schemas.WorkflowStepCreate(
        prompt_template_id=step.prompt_template_id,
        chat_model_id=step.chat_model_id,
        persona_id=step.persona_id
    )
    return crud.create_workflow_step(db=db, workflow_id=workflow_id, step=step_data)


@router.get("/{workflow_id}/steps/", response_model=List[schemas.WorkflowStep])
def read_workflow_steps(workflow_id: int, db: Session = Depends(get_db)):
    steps = crud.get_workflow_steps(db, workflow_id=workflow_id)
    return steps


@router.put("/{workflow_id}/steps/{step_id}", response_model=schemas.WorkflowStep)
def update_workflow_step(workflow_id: int, step_id: int, step: schemas.WorkflowStepUpdate, db: Session = Depends(get_db)):
    db_step = crud.update_workflow_step(db, step_id=step_id, step=step)
    if db_step is None:
        raise HTTPException(status_code=404, detail="Workflow step not found")
    return db_step


@router.delete("/{workflow_id}/steps/{step_id}", response_model=schemas.WorkflowStep)
def delete_workflow_step(workflow_id: int, step_id: int, db: Session = Depends(get_db)):
    db_step = crud.delete_workflow_step(db, step_id=step_id)
    if db_step is None:
        raise HTTPException(status_code=404, detail="Workflow step not found")
    return db_step


@router.post("/{workflow_id}/stream", response_model=Dict[str, str])
async def initiate_workflow_stream(
    workflow_id: int,
    user_input: Dict[str, str],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Initiate a workflow execution and return a stream token"""
    try:
        # Log the request parameters
        logger.info(f"Initiating workflow stream - Workflow ID: {workflow_id}")
        logger.info(f"User input parameters: {json.dumps(user_input, indent=2)}")
        
        # Log the workflow details
        workflow = crud.get_workflow(db, workflow_id=workflow_id)
        if workflow:
            steps = sorted(workflow.steps, key=lambda x: x.position)
            if steps:
                first_step = steps[0]
                logger.info(f"First step prompt template (ID: {first_step.prompt_template_id}): {first_step.prompt_template.prompt}")
                logger.info(f"First step is_complex: {first_step.prompt_template.is_complex}")
                if first_step.prompt_template.is_complex:
                    logger.info("Complex prompt detected for first step")
                    if "message" in user_input:
                        logger.info(f"Using message from user input: {user_input['message']}")
                    else:
                        logger.info("No message found in user input for complex prompt")
        
        # Generate a stream token
        stream_token = await crew_service.prepare_workflow_stream(workflow_id)
        logger.info(f"Generated stream token: {stream_token}")
        
        # Start workflow execution in background
        background_tasks.add_task(
            crew_service.execute_workflow,
            workflow_id=workflow_id,
            user_input=user_input,
            db=db,
            stream_token=stream_token
        )
        
        return {"stream_token": stream_token}
    
    except Exception as e:
        logger.error(f"Error initiating workflow stream: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@public_router.get("/{workflow_id}/stream")
async def stream_workflow_results(
    workflow_id: int,
    stream_token: str,
    request: Request,
    db: Session = Depends(get_db)
):
    try:
        # Log the request parameters
        logger.info(f"Starting stream for workflow ID: {workflow_id}")
        logger.info(f"Stream token: {stream_token}")
        logger.info(f"Request headers: {dict(request.headers)}")
        
        async def event_generator():
            last_result_count = 0
            
            while True:
                if await request.is_disconnected():
                    logger.info("Client disconnected")
                    break

                stream_data = crew_service.get_stream_data(stream_token)
                if not stream_data:
                    yield {
                        "event": "error",
                        "data": json.dumps({
                            "type": "error",
                            "message": "Invalid or expired stream token"
                        })
                    }
                    break

                # Handle errors and validation
                if stream_data['workflow_id'] != workflow_id:
                    yield {
                        "event": "error",
                        "data": json.dumps({
                            "type": "error",
                            "message": "Invalid workflow ID for this token"
                        })
                    }
                    break

                if stream_data['status'] == 'error':
                    yield {
                        "event": "error",
                        "data": json.dumps({
                            "type": "error",
                            "message": stream_data.get('error', 'Unknown error occurred')
                        })
                    }
                    break

                # Stream new results as they come in
                if 'result' in stream_data and stream_data['result']:
                    current_results = stream_data['result']
                    while last_result_count < len(current_results):
                        result = current_results[last_result_count]
                        yield {
                            "event": "message",
                            "data": json.dumps({
                                "type": "step",
                                "step": result["step"],
                                "prompt": result["prompt"],
                                "response": result["response"],
                                "persona": result["persona"],
                                "chat_model": result["chat_model"]
                            })
                        }
                        last_result_count += 1

                # Send completion event when done
                if stream_data['status'] == 'completed':
                    yield {
                        "event": "complete",
                        "data": json.dumps({
                            "type": "status",
                            "message": "Workflow execution completed"
                        })
                    }
                    break

                # Reduced polling interval
                await asyncio.sleep(0.1)  # Poll more frequently

        return EventSourceResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "text/event-stream",
                "X-Accel-Buffering": "no"
            }
        )

    except Exception as e:
        logger.error(f"Error in workflow stream: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))