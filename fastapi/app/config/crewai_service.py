from crewai import Agent, Task, Crew, LLM, Process
from typing import AsyncGenerator, Tuple, Dict, Optional, List
import asyncio
import uuid
import logging
import os
from app import crud, models
from app.database import get_db
from fastapi import HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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

    def _generate_stream_token(self, workflow_id: int) -> str:
        token = str(uuid.uuid4())
        self._stream_tokens[token] = {
            'workflow_id': workflow_id,
            'created_at': datetime.now(),
            'result': None,
            'status': 'pending'
        }
        return token

    def get_stream_data(self, token: str) -> Optional[Dict]:
        # Clean up expired tokens (older than 1 hour)
        current_time = datetime.now()
        expired_tokens = [
            t for t, data in self._stream_tokens.items()
            if current_time - data['created_at'] > timedelta(hours=1)
        ]
        for t in expired_tokens:
            self._stream_tokens.pop(t, None)

        return self._stream_tokens.get(token)

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

    async def execute_workflow(self, workflow_id: int, user_input: dict, db: Session, stream_token: Optional[str] = None):
        try:
            workflow = crud.get_workflow(db, workflow_id=workflow_id)
            if not workflow:
                raise HTTPException(status_code=404, detail="Workflow not found")

            max_iterations = workflow.max_iterations if workflow.process_type == models.ProcessType.HIERARCHICAL.value else None

            agents = []
            tasks = []
            task_metadata = {}
            manager = None
            manager_llm = None

            # Set up manager for hierarchical workflows
            if workflow.process_type == models.ProcessType.HIERARCHICAL.value:
                if not workflow.manager_chat_model_id or not workflow.manager_persona_id:
                    raise CrewAIError("Manager chat model and persona IDs are required for hierarchical workflows")
                
                manager_persona = crud.get_persona(db, workflow.manager_persona_id)
                manager_chat_model = crud.get_chat_model(db, workflow.manager_chat_model_id)
                
                if not manager_persona or not manager_chat_model:
                    raise CrewAIError("Manager persona or chat model not found")
                
                manager_llm = LLM(
                    model=f"openrouter/{manager_chat_model.model}",
                    api_key=self.api_key,
                    base_url=self.base_url
                )
                
                manager = Agent(
                    role=manager_persona.role,
                    goal=manager_persona.goal,
                    backstory=manager_persona.backstory,
                    allow_delegation=manager_persona.allow_delegation,
                    verbose=manager_persona.verbose,
                    llm=manager_llm
                )

            # Initialize results list for this stream token
            if stream_token:
                self._task_results[stream_token] = []
                self._stream_tokens[stream_token]['status'] = 'running'

            # Create agents and tasks with metadata
            for i, step in enumerate(sorted(workflow.steps, key=lambda x: x.position)):
                persona = step.persona
                chat_model = step.chat_model
                agent = self.create_agent(persona, chat_model, max_iterations)
                agents.append(agent)

                metadata = {
                    "step": i + 1,
                    "persona": {
                        "id": persona.id,
                        "role": persona.role,
                        "goal": persona.goal
                    },
                    "chat_model": {
                        "id": chat_model.id,
                        "name": chat_model.name,
                        "model": chat_model.model
                    },
                    "prompt": step.prompt_template.prompt.format(**user_input)
                }

                def create_callback(step_metadata):
                    def callback(output):
                        if stream_token:
                            result = {
                                "step": step_metadata["step"],
                                "prompt": step_metadata["prompt"],
                                "response": output.raw if hasattr(output, 'raw') else str(output),
                                "persona": step_metadata["persona"],
                                "chat_model": step_metadata["chat_model"]
                            }
                            self._task_results[stream_token].append(result)
                            self._stream_tokens[stream_token]['result'] = self._task_results[stream_token]
                    return callback

                task = Task(
                    description=metadata["prompt"],
                    agent=agent,
                    expected_output="Quality writing",
                    callback=create_callback(metadata)
                )
                tasks.append(task)

            process = Crew(
                agents=agents,
                tasks=tasks,
                process=Process.sequential if workflow.process_type == models.ProcessType.SEQUENTIAL.value else Process.hierarchical,
                manager_agent=manager if workflow.process_type == models.ProcessType.HIERARCHICAL.value else None,
                manager_llm=manager_llm if workflow.process_type == models.ProcessType.HIERARCHICAL.value else None,
                verbose=True
            )

            result = await asyncio.to_thread(process.kickoff)
            
            # Mark as completed after all tasks are done
            if stream_token and stream_token in self._stream_tokens:
                self._stream_tokens[stream_token]['status'] = 'completed'

            return self._task_results.get(stream_token, [])

        except Exception as e:
            if stream_token and stream_token in self._stream_tokens:
                self._stream_tokens[stream_token]['status'] = 'error'
                self._stream_tokens[stream_token]['error'] = str(e)
            logger.error(f"Error executing workflow: {str(e)}")
            raise CrewAIError(f"Workflow execution failed: {str(e)}")

crew_service = CrewAIService()