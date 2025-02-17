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
        self._stream_tokens: Dict[str, Dict] = {}
        self._task_metadata: Dict[int, Dict] = {}
        self._task_results: Dict[str, List] = {}
        self._stdout_buffers: Dict[str, StringIO] = {}

    def _generate_stream_token(self, workflow_id: UUID) -> str:
        token = str(uuid.uuid4())
        self._stream_tokens[token] = {
            'workflow_id': workflow_id,
            'created_at': datetime.now(),
            'result': None,
            'status': 'pending'
        }
        return token

    def get_stream_data(self, token: str) -> Optional[Dict]:
        data = self._stream_tokens.get(token)
        if data and token in self._stdout_buffers:
            # Get any new output from the buffer
            buffer = self._stdout_buffers[token]
            buffer_value = buffer.getvalue()
            if buffer_value:
                try:
                    # Process each line immediately
                    lines = buffer_value.splitlines()
                    for line in lines:
                        if line.strip():
                            try:
                                result = json.loads(line)
                                if 'result' not in data:
                                    data['result'] = []
                                data['result'].append(result)
                                # Flush after each line
                                buffer.flush()
                            except json.JSONDecodeError:
                                continue
                
                    # Clear the buffer after processing
                    buffer.truncate(0)
                    buffer.seek(0)
                    buffer.flush()
                except Exception as e:
                    logger.error(f"Error processing buffer: {str(e)}")

        return data

    async def prepare_workflow_stream(self, workflow_id: int) -> str:
        """Generate and return a unique token for streaming"""
        return self._generate_stream_token(workflow_id)

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

    def create_callback(self, step_metadata, stream_token):
        def callback(output):
            if stream_token:
                result = {
                    "step": step_metadata["step"],
                    "prompt": step_metadata["prompt"],
                    "response": output.raw if hasattr(output, 'raw') else str(output),
                    "persona": {
                        "id": str(step_metadata["persona"]["id"]),
                        "role": step_metadata["persona"]["role"],
                        "goal": step_metadata["persona"]["goal"]
                    },
                    "chat_model": {
                        "id": str(step_metadata["chat_model"]["id"]),
                        "name": step_metadata["chat_model"]["name"],
                        "model": step_metadata["chat_model"]["model"]
                    }
                }
                self._task_results[stream_token].append(result)
                self._stream_tokens[stream_token]['result'] = self._task_results[stream_token]

                # Use UUIDEncoder for JSON serialization
                print(json.dumps(result, cls=UUIDEncoder), flush=True)
                if stream_token in self._stdout_buffers:
                    self._stdout_buffers[stream_token].flush()
        return callback

    async def execute_workflow(self, workflow_id: UUID, user_input: Dict[str, Any], db: Session, stream_token: str):
        try:
            workflow = db.query(models.Workflow).options(
                joinedload(models.Workflow.steps),
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
            results = []

            for i, step in enumerate(sorted(workflow.steps, key=lambda x: x.position)):
                persona = step.persona
                chat_model = step.chat_model
                agent = self.create_agent(persona, chat_model)
                agents.append(agent)

                # Build prompt with RAG content
                description = user_input.get("message") if i == 0 and "message" in user_input else step.prompt_template.prompt

                if workflow.assets or workflow.knowledge_bases:
                    kb_ids = [kb.id for kb in workflow.knowledge_bases] if workflow.knowledge_bases else None
                    asset_ids = [asset.id for asset in workflow.assets] if workflow.assets else None
                    
                    reference_content, content_tokens, used_rag = get_optimized_reference_content(
                        db=db,
                        query_text=description,
                        knowledge_base_ids=kb_ids,
                        asset_ids=asset_ids,
                        max_tokens=step.chat_model.max_tokens,
                        token_threshold=0.75
                    )
                    
                    if reference_content:
                        description = f"{description}\n\nReferenced Content:\n{reference_content}"

                metadata = {
                    "step": i + 1,
                    "persona": {
                        "id": str(persona.id),
                        "role": persona.role,
                        "goal": persona.goal
                    },
                    "chat_model": {
                        "id": str(chat_model.id),
                        "name": chat_model.name,
                        "model": chat_model.model
                    },
                    "prompt": description
                }

                task = Task(
                    description=metadata["prompt"],
                    agent=agent,
                    expected_output="Quality writing",
                    callback=self.create_callback(metadata, stream_token)
                )
                tasks.append(task)

            process = Crew(
                agents=agents,
                tasks=tasks,
                process=Process.sequential if workflow.process_type == models.ProcessType.SEQUENTIAL.value else Process.hierarchical,
                manager_agent=None,
                manager_llm=None,
                verbose=True
            )

            result = await asyncio.to_thread(process.kickoff)
            
            results = self._task_results.get(stream_token, [])

            self._update_stream_data(stream_token, {
                'workflow_id': workflow_id,
                'status': 'completed',
                'result': results
            })

        except Exception as e:
            logger.error(f"Error in workflow execution: {str(e)}")
            self._update_stream_data(stream_token, {
                'workflow_id': workflow_id,
                'status': 'error',
                'error': str(e)
            })

    def _update_stream_data(self, stream_token: str, data: Dict):
        if stream_token in self._stream_tokens:
            self._stream_tokens[stream_token].update(data)
            if stream_token in self._stdout_buffers:
                self._stdout_buffers[stream_token].flush()

crew_service = CrewAIService()