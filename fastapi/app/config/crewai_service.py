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

class CrewAIService:
    def __init__(self):
        self.api_key = os.environ.get("OPENROUTER_API_KEY")
        self.base_url = os.environ.get("OPENROUTER_API_BASE")
        self._stream_tokens = {}  # Store stream data
        self._task_results = {}   # Store task results

    async def prepare_workflow_stream(self, workflow_id: UUID) -> str:
        """Initialize a new stream for a workflow"""
        stream_token = str(uuid.uuid4())
        self._stream_tokens[stream_token] = {
            'workflow_id': workflow_id,
            'status': 'pending',
            'result': []
        }
        self._task_results[stream_token] = []
        return stream_token

    def get_stream_data(self, stream_token: str) -> Optional[Dict]:
        """Get current stream data"""
        return self._stream_tokens.get(stream_token)

    def create_agent(self, persona, chat_model, max_iterations=None):
        try:
            llm = LLM(
                model=f"openrouter/{chat_model.model}",
                api_key=self.api_key,
                base_url=self.base_url
            )
            agent = Agent(
                role=persona.role,
                goal=persona.goal,
                backstory=persona.backstory,
                allow_delegation=persona.allow_delegation,
                verbose=persona.verbose,
                llm=llm,
                max_iter=max_iterations if max_iterations is not None else 1
            )
            return agent
        except Exception as e:
            logger.error(f"Failed to create agent: {str(e)}")
            raise CrewAIError(f"Agent creation failed: {str(e)}")

    def create_callback(self, metadata: Dict, stream_token: str):
        """Create a callback function for task results"""
        def callback(output):
            if stream_token in self._stream_tokens:
                result = {
                    "step": metadata["step"],
                    "prompt": metadata["prompt"],
                    "response": output.raw if hasattr(output, 'raw') else str(output),
                    "persona": metadata["persona"],
                    "chat_model": metadata["chat_model"]
                }
                self._task_results[stream_token].append(result)
                self._stream_tokens[stream_token]['result'] = self._task_results[stream_token]
        return callback

    async def execute_workflow(self, workflow_id: UUID, user_input: Dict[str, Any], db: Session, stream_token: str):
        try:
            # Get workflow with relationships
            workflow = db.query(models.Workflow).options(
                joinedload(models.Workflow.steps).joinedload(models.WorkflowStep.prompt_template),
                joinedload(models.Workflow.steps).joinedload(models.WorkflowStep.chat_model),
                joinedload(models.Workflow.steps).joinedload(models.WorkflowStep.persona),
                joinedload(models.Workflow.assets),
                joinedload(models.Workflow.knowledge_bases)
            ).filter(
                models.Workflow.id == workflow_id
            ).first()

            if not workflow:
                self._update_stream_data(stream_token, {'status': 'error', 'error': 'Workflow not found'})
                return

            agents = []
            tasks = []

            for i, step in enumerate(sorted(workflow.steps, key=lambda x: x.position)):
                prompt_template = step.prompt_template
                chat_model = step.chat_model
                persona = step.persona

                # Create agent
                agent = self.create_agent(persona, chat_model)
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

                # Create task with callback
                metadata = {
                    "step": i + 1,
                    "prompt": description,
                    "persona": {
                        "id": persona.id,
                        "role": persona.role,
                        "goal": persona.goal
                    },
                    "chat_model": {
                        "id": chat_model.id,
                        "name": chat_model.name,
                        "model": chat_model.model
                    }
                }

                task = Task(
                    description=description,
                    agent=agent,
                    expected_output="Quality writing",
                    callback=self.create_callback(metadata, stream_token)
                )
                tasks.append(task)

            # Execute workflow
            crew = Crew(
                agents=agents,
                tasks=tasks,
                process=Process.sequential if workflow.process_type == models.ProcessType.SEQUENTIAL.value else Process.hierarchical,
                verbose=True
            )

            result = await asyncio.to_thread(crew.kickoff)
            
            # Mark as completed
            self._update_stream_data(stream_token, {
                'status': 'completed'
            })

        except Exception as e:
            logger.error(f"Error in workflow execution: {str(e)}")
            self._update_stream_data(stream_token, {
                'status': 'error',
                'error': str(e)
            })

    def _update_stream_data(self, stream_token: str, data: Dict):
        """Update stream data safely"""
        if stream_token in self._stream_tokens:
            self._stream_tokens[stream_token].update(data)

crew_service = CrewAIService()