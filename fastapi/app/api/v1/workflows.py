from fastapi import Depends, HTTPException, BackgroundTasks, WebSocket, Request
from sqlalchemy.orm import Session, joinedload
from typing import List, Dict, Optional, Any
from app import crud, schemas, models
from app.database import get_db
from app.api.v1.router import create_protected_router, create_public_router
from app.schemas import ChatMessage, WorkflowExecuteInput
from crewai import Agent, Task, Crew, Process, LLM
import logging
import os
from dotenv import load_dotenv
import asyncio
from sse_starlette.sse import EventSourceResponse
from app.config.crewai_service import crew_service, CrewAIError
import json
from uuid import UUID
from app.api.v1.dependencies import get_current_user
from uuid import uuid4
from llama_index.storage.chat_store.postgres import PostgresChatStore
from llama_index.core.memory import ChatMemoryBuffer
from llama_index.core.llms import ChatMessage as LlamaChatMessage, MessageRole
from fastapi.responses import StreamingResponse
from app.config.rag_utils import get_optimized_reference_content
from pydantic import BaseModel

# Load environment variables
load_dotenv()

# Get database URL
ASYNC_DATABASE_URL = os.environ.get("ASYNC_DATABASE_URL")
if not ASYNC_DATABASE_URL:
    raise ValueError("ASYNC_DATABASE_URL environment variable is not set")

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
            raise HTTPException(
                status_code=400, 
                detail="Manager chat model and persona IDs are required for hierarchical workflows."
            )
    return crud.create_workflow(db=db, workflow=workflow)


@router.get("/", response_model=List[schemas.Workflow])
def read_workflows(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    workflows = crud.get_workflows(db, skip=skip, limit=limit)
    return workflows


@router.get("/{workflow_id}", response_model=schemas.Workflow)
def get_workflow(workflow_id: UUID, db: Session = Depends(get_db)):
    db_workflow = crud.get_workflow(db, workflow_id=workflow_id)
    if db_workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Ensure max_iterations is a valid integer
    if db_workflow.max_iterations is None:
        db_workflow.max_iterations = 1  # Set a default value if None

    return db_workflow


@router.put("/{workflow_id}", response_model=schemas.Workflow)
def update_workflow(
    workflow_id: UUID,
    workflow: schemas.WorkflowUpdate,
    db: Session = Depends(get_db)
):
    if workflow.process_type == models.ProcessType.HIERARCHICAL.value:
        if not workflow.manager_chat_model_id or not workflow.manager_persona_id:
            raise HTTPException(status_code=400, detail="Manager chat model and persona IDs are required for hierarchical workflows.")
    db_workflow = crud.update_workflow(db, workflow_id=workflow_id, workflow=workflow)
    if db_workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return db_workflow


@router.delete("/{workflow_id}")
def delete_workflow(workflow_id: UUID, db: Session = Depends(get_db)):
    db_workflow = crud.delete_workflow(db, workflow_id=workflow_id)
    if db_workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"ok": True}


@router.post("/{workflow_id}/execute", response_model=Dict[str, str])
async def execute_workflow(
    workflow_id: UUID, 
    user_input: WorkflowExecuteInput,  
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db)
):
    try:
        # Use the same eager loading as the GET endpoint
        workflow = db.query(models.Workflow).options(
            joinedload(models.Workflow.steps),
            joinedload(models.Workflow.assets),
            joinedload(models.Workflow.knowledge_bases),
            joinedload(models.Workflow.steps).joinedload(models.WorkflowStep.prompt_template),
            joinedload(models.Workflow.steps).joinedload(models.WorkflowStep.chat_model),
            joinedload(models.Workflow.steps).joinedload(models.WorkflowStep.persona)
        ).filter(
            models.Workflow.id == workflow_id
        ).first()

        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        # Debug logging
        logger.info(f"Workflow {workflow_id} loaded for execution with:")
        logger.info(f"- {len(workflow.steps)} steps")
        logger.info(f"- {len(workflow.assets)} assets")
        logger.info(f"- {len(workflow.knowledge_bases)} knowledge bases")

        if workflow.assets:
            logger.info("Assets found:")
            for asset in workflow.assets:
                logger.info(f"- Asset {asset.id}: {asset.title}")
                logger.info(f"  Content preview: {asset.content[:100] if asset.content else 'No content'}")

        # Detailed logging of workflow relationships
        logger.info(f"Workflow {workflow_id} resources:")
        logger.info(f"Raw assets data: {workflow.assets}")
        logger.info(f"Raw knowledge bases data: {workflow.knowledge_bases}")
        
        if workflow.assets:
            logger.info(f"Associated assets: {[(asset.id, asset.title, asset.content[:100] if asset.content else 'No content') for asset in workflow.assets]}")
        else:
            logger.info("No assets associated with this workflow")
            
        if workflow.knowledge_bases:
            logger.info(f"Associated knowledge bases: {[(kb.id, kb.title) for kb in workflow.knowledge_bases]}")
            for kb in workflow.knowledge_bases:
                logger.info(f"Knowledge base {kb.id} assets: {[(asset.id, asset.title) for asset in kb.assets]}")
        else:
            logger.info("No knowledge bases associated with this workflow")

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
                        max_iter=max_iterations if max_iterations is not None else 1
                    )
                    agents.append(agent)

                    # Build the initial prompt
                    if i == 0 and user_input.message:
                        description = user_input.message
                    else:
                        description = prompt_template.prompt

                    # Get knowledge bases and assets from the workflow
                    if workflow.knowledge_bases or workflow.assets:
                        # Verify the data is still available
                        logger.info(f"Step {i+1} - Verifying data:")
                        logger.info(f"Available assets: {[asset.id for asset in workflow.assets]}")
                        logger.info(f"Available knowledge bases: {[kb.id for kb in workflow.knowledge_bases]}")
                        
                        kb_ids = [kb.id for kb in workflow.knowledge_bases] if workflow.knowledge_bases else None
                        asset_ids = [asset.id for asset in workflow.assets] if workflow.assets else None
                        
                        logger.info(f"Step {i+1}: Retrieving content from:")
                        if kb_ids:
                            logger.info(f"- Knowledge Base IDs: {kb_ids}")
                        if asset_ids:
                            logger.info(f"- Asset IDs: {asset_ids}")
                        
                        # Add debug logging for the RAG function call
                        logger.info(f"Calling get_optimized_reference_content with:")
                        logger.info(f"- query_text: {description[:100]}...")
                        logger.info(f"- knowledge_base_ids: {kb_ids}")
                        logger.info(f"- asset_ids: {asset_ids}")
                        logger.info(f"- max_tokens: {chat_model.max_tokens}")
                        
                        reference_content, content_tokens, used_rag = get_optimized_reference_content(
                            db=db,
                            query_text=description,
                            knowledge_base_ids=kb_ids,
                            asset_ids=asset_ids,
                            max_tokens=chat_model.max_tokens,
                            token_threshold=0.75
                        )
                        
                        if reference_content:
                            strategy = "RAG" if used_rag else "full content"
                            logger.info(f"Step {i+1}: Added referenced content using {strategy} strategy")
                            logger.info(f"- Token count: {content_tokens}")
                            logger.info(f"- Content preview: {reference_content[:200]}...")
                            description = f"{description}\n\nReferenced Content:\n{reference_content}"
                        else:
                            logger.warning(f"Step {i+1}: No reference content was retrieved")
                            logger.warning("This might indicate an issue with the RAG function or the content retrieval")

                    logger.info(f"Step {i+1} final prompt: {description[:200]}...")
                    
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
                }, {"completed": True}]
                return {"result": f"Error during workflow execution: {str(e)}"}

        background_tasks.add_task(run_workflow)
        return {"message": "Workflow execution started in the background"}

    except Exception as e:
        logger.error(f"Error executing workflow: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{workflow_id}/results", response_model=List[Dict[str, str]])
async def get_workflow_results(workflow_id: UUID):
    results = workflow_results.get(str(workflow_id), [])
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
def create_workflow_step(
    workflow_id: UUID,
    step: schemas.WorkflowStepCreate,
    db: Session = Depends(get_db)
):
    try:
        return crud.create_workflow_step(db=db, workflow_id=workflow_id, step=step)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating workflow step: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{workflow_id}/steps/", response_model=List[schemas.WorkflowStep])
def read_workflow_steps(workflow_id: UUID, db: Session = Depends(get_db)):
    steps = crud.get_workflow_steps(db, workflow_id=workflow_id)
    return steps


@router.put("/{workflow_id}/steps/{step_id}", response_model=schemas.WorkflowStep)
def update_workflow_step(
    workflow_id: UUID,
    step_id: UUID,
    step: schemas.WorkflowStepUpdate,
    db: Session = Depends(get_db)
):
    db_step = crud.update_workflow_step(db, step_id=step_id, step=step)
    if db_step is None:
        raise HTTPException(status_code=404, detail="Workflow step not found")
    return db_step


@router.delete("/{workflow_id}/steps/{step_id}", response_model=schemas.WorkflowStep)
def delete_workflow_step(
    workflow_id: UUID,
    step_id: UUID,
    db: Session = Depends(get_db)
):
    db_step = crud.delete_workflow_step(db, step_id=step_id)
    if db_step is None:
        raise HTTPException(status_code=404, detail="Workflow step not found")
    return db_step


@router.post("/{workflow_id}/stream", response_class=EventSourceResponse)
async def stream_workflow(
    workflow_id: UUID,
    request: Request,
    user_input: Optional[Dict[str, Any]] = None,
    db: Session = Depends(get_db)
):
    try:
        # Get the workflow with eager loading of all relationships
        workflow = db.query(models.Workflow).options(
            joinedload(models.Workflow.steps),
            joinedload(models.Workflow.assets),
            joinedload(models.Workflow.knowledge_bases)
        ).filter(
            models.Workflow.id == workflow_id
        ).first()

        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        # Log workflow details
        logger.info(f"Workflow {workflow_id} loaded with:")
        logger.info(f"- {len(workflow.steps)} steps")
        logger.info(f"- {len(workflow.assets)} assets")
        logger.info(f"- {len(workflow.knowledge_bases)} knowledge bases")
        
        if workflow.assets:
            logger.info("Assets found:")
            for asset in workflow.assets:
                logger.info(f"- Asset {asset.id}: {asset.title}")
                logger.info(f"  Content preview: {asset.content[:100] if asset.content else 'No content'}")

        # Generate stream token and start workflow execution
        stream_token = await crew_service.prepare_workflow_stream(workflow_id)
        logger.info(f"Generated stream token: {stream_token}")

        # Start workflow execution in background
        asyncio.create_task(
            crew_service.execute_workflow(
                workflow_id=workflow_id,
                user_input=user_input or {},
                db=db,
                stream_token=stream_token
            )
        )

        async def event_generator():
            try:
                while True:
                    # Check if client is still connected
                    if await request.is_disconnected():
                        logger.info("Client disconnected, stopping stream")
                        break

                    # Get current status
                    status = crew_service.get_stream_status(stream_token)
                    if status:
                        yield {
                            "event": "message",
                            "data": json.dumps(status)
                        }

                        # If workflow is complete or has error, stop streaming
                        if status.get("completed") or status.get("error"):
                            logger.info(f"Workflow complete or error detected: {status}")
                            break

                    await asyncio.sleep(0.1)  # Small delay to prevent CPU overload

            except Exception as e:
                logger.error(f"Error in event generator: {str(e)}")
                yield {
                    "event": "error",
                    "data": json.dumps({"error": str(e)})
                }

        return EventSourceResponse(event_generator())

    except Exception as e:
        logger.error(f"Error in workflow stream: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@public_router.get("/{workflow_id}/stream")
async def stream_workflow_results(
    workflow_id: UUID,
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
            try:
                while True:
                    try:
                        if await request.is_disconnected():
                            logger.info(f"Client disconnected for workflow ID: {workflow_id}")
                            return

                        stream_data = crew_service.get_stream_data(stream_token)
                        if not stream_data:
                            yield f"event: error\ndata: {json.dumps({'error': 'Invalid or expired stream token'})}\n\n"
                            return

                        # Handle errors and validation
                        if str(stream_data['workflow_id']) != str(workflow_id):  # Convert both to string for comparison
                            yield f"event: error\ndata: {json.dumps({'error': 'Invalid workflow ID for this token'})}\n\n"
                            return

                        if stream_data['status'] == 'error':
                            yield f"event: error\ndata: {json.dumps({'error': stream_data.get('error', 'Unknown error occurred')})}\n\n"
                            return

                        # Stream new results as they come in
                        if 'result' in stream_data and stream_data['result']:
                            current_results = stream_data['result']
                            while last_result_count < len(current_results):
                                result = current_results[last_result_count]
                                # Ensure result is a dictionary before accessing keys
                                if isinstance(result, dict):
                                    yield {
                                        "event": "message",
                                        "data": json.dumps({
                                            "type": "step",
                                            "step": result.get("step", last_result_count + 1),
                                            "prompt": result.get("prompt", ""),
                                            "response": result.get("response", ""),
                                            "persona": result.get("persona", {}),
                                            "chat_model": result.get("chat_model", {})
                                        })
                                    }
                                else:
                                    # Handle string or other non-dict results
                                    yield {
                                        "event": "message",
                                        "data": json.dumps({
                                            "type": "step",
                                            "step": last_result_count + 1,
                                            "response": str(result),
                                            "prompt": "",
                                            "persona": {},
                                            "chat_model": {}
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
                            return

                        await asyncio.sleep(0.1)  # Poll more frequently

                    except asyncio.CancelledError:
                        logger.info(f"Stream cancelled for workflow ID: {workflow_id}")
                        return
                    except Exception as e:
                        logger.error(f"Error in event stream for workflow {workflow_id}: {str(e)}")
                        yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
                        return

            except Exception as e:
                logger.error(f"Generator error for workflow {workflow_id}: {str(e)}")
                yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

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