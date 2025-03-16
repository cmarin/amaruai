from crewai import Agent, Task, Crew, LLM, Process
from typing import AsyncGenerator, Tuple, Dict, Optional, List, Any
import asyncio
import uuid
import logging
import os
import sys
from uuid import UUID
from io import StringIO
from app import crud, models
from app.database import get_db
from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timedelta
import json
from app.config.rag_utils import get_optimized_reference_content

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Reduce noise from HTTP client libraries
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("hpack").setLevel(logging.WARNING)
logging.getLogger("openai").setLevel(logging.WARNING)

class UUIDEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, UUID):
            return str(obj)
        return super().default(obj)

class CrewAIError(Exception):
    """Custom exception for CrewAI operations"""
    pass

class StreamingTask(Task):
    """Custom Task class that provides real-time streaming updates"""
    
    def __init__(self, *args, **kwargs):
        self.stream_token = kwargs.pop('stream_token', None)
        self.step_number = kwargs.pop('step_number', 0)
        self.update_callback = kwargs.pop('update_callback', None)
        super().__init__(*args, **kwargs)
        self._partial_output = ""
    
    def execute(self):
        """Execute the task and provide real-time streaming updates"""
        try:
            # Start execution
            if self.update_callback and self.stream_token:
                self.update_callback(self.stream_token, {
                    "step": str(self.step_number),
                    "prompt": self.description,
                    "status": "executing",
                    "response": ""
                })
            
            # Execute the task
            result = super().execute()
            
            # Update with final result
            if self.update_callback and self.stream_token:
                self.update_callback(self.stream_token, {
                    "step": str(self.step_number),
                    "prompt": self.description,
                    "status": "completed",
                    "response": result.raw if hasattr(result, 'raw') else str(result)
                })
            
            return result
        except Exception as e:
            # Update with error
            if self.update_callback and self.stream_token:
                self.update_callback(self.stream_token, {
                    "step": str(self.step_number),
                    "prompt": self.description,
                    "status": "error",
                    "response": f"Error: {str(e)}"
                })
            raise

class CrewAIService:
    def __init__(self):
        self.api_key = os.environ.get("OPENROUTER_API_KEY")
        self.base_url = os.environ.get("OPENROUTER_API_BASE")
        self._streams = {}

    async def prepare_workflow_stream(self, workflow_id: UUID) -> str:
        stream_token = str(uuid.uuid4())
        self._streams[stream_token] = {
            'workflow_id': workflow_id,
            'status': 'pending',
            'result': []
        }
        return stream_token

    def get_stream_data(self, stream_token: str) -> Optional[Dict]:
        return self._streams.get(stream_token)

    def _update_stream_data(self, stream_token: str, result: Dict):
        if stream_token in self._streams:
            if 'result' not in self._streams[stream_token]:
                self._streams[stream_token]['result'] = []
            
            # Add timestamp for debugging
            result['timestamp'] = datetime.now().isoformat()
            
            # Log the update for debugging
            logger.info(f"Updating stream {stream_token} with result: {json.dumps(result, cls=UUIDEncoder)[:200]}...")
            
            # Add the result to the stream data
            self._streams[stream_token]['result'].append(result)

    async def execute_workflow(self, workflow_id: UUID, user_input: dict, db: Session, stream_token: str):
        try:
            workflow = db.query(models.Workflow).options(
                joinedload(models.Workflow.steps),
                joinedload(models.Workflow.assets),
                joinedload(models.Workflow.knowledge_bases)
            ).filter(models.Workflow.id == workflow_id).first()

            if not workflow:
                self._streams[stream_token]['status'] = 'error'
                self._streams[stream_token]['error'] = 'Workflow not found'
                return

            # Get default chat model
            default_chat_model = db.query(models.ChatModel).filter(
                models.ChatModel.default == True
            ).first()

            if not default_chat_model:
                self._streams[stream_token]['status'] = 'error'
                self._streams[stream_token]['error'] = 'No default chat model configured'
                return

            agents = []
            tasks = []

            for i, step in enumerate(sorted(workflow.steps, key=lambda x: x.position)):
                # Skip steps without a prompt template
                if not step.prompt_template:
                    logger.warning(f"Skipping step {i+1} (position {step.position}) - missing prompt template")
                    continue
                    
                prompt_template = step.prompt_template
                chat_model = step.chat_model or default_chat_model
                persona = step.persona

                # Create agent with default values if no persona specified
                if persona and hasattr(persona, 'temperature') and persona.temperature is not None:
                    llm = LLM(
                        model=f"openrouter/{chat_model.model}",
                        api_key=self.api_key,
                        base_url=self.base_url,
                        temperature=persona.temperature
                    )
                else:
                    llm = LLM(
                        model=f"openrouter/{chat_model.model}",
                        api_key=self.api_key,
                        base_url=self.base_url
                    )

                if persona:
                    agent = Agent(
                        role=persona.role,
                        goal=persona.goal,
                        backstory=persona.backstory,
                        allow_delegation=persona.allow_delegation,
                        verbose=persona.verbose,
                        llm=llm
                    )
                else:
                    # Default agent configuration when no persona is specified
                    agent = Agent(
                        role="Assistant",
                        goal="Help complete the task effectively",
                        backstory="I am an AI assistant focused on completing tasks accurately.",
                        allow_delegation=False,
                        verbose=True,
                        llm=llm
                    )
                agents.append(agent)

                # Build prompt with RAG content
                description = user_input.get("message") if i == 0 and "message" in user_input else prompt_template.prompt

                if workflow.assets or workflow.knowledge_bases:
                    kb_ids = [kb.id for kb in workflow.knowledge_bases] if workflow.knowledge_bases else None
                    asset_ids = [asset.id for asset in workflow.assets] if workflow.assets else None
                    
                    reference_content, content_tokens, used_rag = get_optimized_reference_content(
                        db=db,
                        query_text=description,
                        knowledge_base_ids=kb_ids,
                        asset_ids=asset_ids,
                        max_tokens=chat_model.max_tokens,
                        token_threshold=0.75
                    )
                    
                    if reference_content:
                        description = f"{description}\n\nReferenced Content:\n{reference_content}"

                # Create task
                task = StreamingTask(
                    description=description,
                    agent=agent,
                    expected_output="Quality writing",
                    stream_token=stream_token,
                    step_number=i + 1,
                    update_callback=self._update_stream_data
                )
                tasks.append(task)

                # Stream step start with optional persona info
                step_info = {
                    "step": str(i + 1),
                    "prompt": description,
                    "status": "starting",
                    "chat_model": {
                        "id": str(chat_model.id),
                        "name": chat_model.name,
                        "model": chat_model.model
                    }
                }

                # Only include persona info if it exists
                if persona:
                    step_info["persona"] = {
                        "id": str(persona.id),
                        "role": persona.role,
                        "goal": persona.goal
                    }
                else:
                    step_info["persona"] = None

                self._update_stream_data(stream_token, step_info)

            # Execute workflow with real-time updates
            if workflow.process_type == models.ProcessType.SEQUENTIAL.value:
                # For sequential workflows, execute tasks one by one and update stream after each
                for i, task in enumerate(tasks):
                    try:
                        # Execute the task
                        result = await asyncio.to_thread(task.execute)
                        
                        # Small delay to ensure streaming
                        await asyncio.sleep(0.1)
                        
                    except Exception as e:
                        logger.error(f"Error executing task {i+1}: {str(e)}")
                        self._update_stream_data(stream_token, {
                            "step": str(i + 1),
                            "prompt": task.description,
                            "response": f"Error: {str(e)}"
                        })
                
                # Mark as completed after all tasks are done
                self._streams[stream_token]['status'] = 'completed'
            else:
                # For hierarchical workflows, use the Crew to manage execution
                crew = Crew(
                    agents=agents,
                    tasks=tasks,
                    process=Process.hierarchical,
                    verbose=True
                )

                # Execute the crew
                result = await asyncio.to_thread(crew.kickoff)

                # No need to stream results after execution as StreamingTask will handle it
                
                # Mark as completed
                self._streams[stream_token]['status'] = 'completed'

        except Exception as e:
            logger.error(f"Error in workflow execution: {str(e)}")
            self._streams[stream_token]['status'] = 'error'
            self._streams[stream_token]['error'] = str(e)
            raise

crew_service = CrewAIService()