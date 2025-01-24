from crewai import Agent, Task, Crew, LLM, Process
from typing import AsyncGenerator, Tuple, Dict, Optional, List
import asyncio
import uuid
import logging
import os
import sys
from io import StringIO
from app import crud, models
from app.database import get_db
from fastapi import HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Reduce noise from HTTP client libraries
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("hpack").setLevel(logging.WARNING)
logging.getLogger("openai").setLevel(logging.WARNING)

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

            # Initialize results and stdout buffer for this stream token
            if stream_token:
                self._task_results[stream_token] = []
                self._stream_tokens[stream_token]['status'] = 'running'
                self._stdout_buffers[stream_token] = StringIO()

            # Redirect stdout to capture CrewAI output
            old_stdout = sys.stdout
            if stream_token:
                sys.stdout = self._stdout_buffers[stream_token]

            try:
                # Create agents and tasks with metadata
                for i, step in enumerate(sorted(workflow.steps, key=lambda x: x.position)):
                    persona = step.persona
                    chat_model = step.chat_model
                    agent = self.create_agent(persona, chat_model, max_iterations)
                    agents.append(agent)

                    # Handle complex prompts and variable substitution
                    try:
                        if i == 0 and step.prompt_template.is_complex and "message" in user_input:
                            logger.info(f"Using message for complex prompt in step {i}: {user_input['message']}")
                            formatted_prompt = user_input["message"]
                        else:
                            logger.info(f"Formatting prompt template for step {i}: {step.prompt_template.prompt}")
                            formatted_prompt = step.prompt_template.prompt.format(**user_input)
                    except KeyError as e:
                        logger.warning(f"Missing variable in prompt template: {str(e)}")
                        formatted_prompt = step.prompt_template.prompt  # Use raw prompt as fallback

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
                        "prompt": formatted_prompt
                    }

                    def create_callback(step_metadata):
                        def callback(output):
                            if stream_token:
                                result = {
                                    "step": step_metadata["step"],
                                    "content": output.raw if hasattr(output, 'raw') else str(output),
                                    "role": "assistant"
                                }
                                self._task_results[stream_token].append(result)
                                self._stream_tokens[stream_token]['result'] = self._task_results[stream_token]

                                # Write to buffer and flush immediately
                                print(json.dumps(result), flush=True)
                                if stream_token in self._stdout_buffers:
                                    self._stdout_buffers[stream_token].flush()
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
                
                # Process task outputs after kickoff
                for i, task in enumerate(tasks):
                    try:
                        task_output = task.output
                        if task_output is not None:
                            result = {
                                "step": i + 1,
                                "content": task_output.raw if hasattr(task_output, 'raw') else str(task_output),
                                "role": "assistant"
                            }
                            if stream_token:
                                self._task_results[stream_token].append(result)
                                self._stream_tokens[stream_token]['result'] = self._task_results[stream_token]
                    except Exception as e:
                        logger.error(f"Error processing task {i+1} output: {str(e)}")
                
                # Mark as completed after all tasks are done
                if stream_token and stream_token in self._stream_tokens:
                    self._stream_tokens[stream_token]['status'] = 'completed'

                return self._task_results.get(stream_token, [])

            finally:
                # Restore stdout
                sys.stdout = old_stdout

        except Exception as e:
            if stream_token and stream_token in self._stream_tokens:
                self._stream_tokens[stream_token]['status'] = 'error'
                self._stream_tokens[stream_token]['error'] = str(e)
            logger.error(f"Error executing workflow: {str(e)}")
            raise CrewAIError(f"Workflow execution failed: {str(e)}")

crew_service = CrewAIService()