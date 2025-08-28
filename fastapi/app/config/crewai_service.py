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
from app.database import get_db, SessionLocal
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
        self._streams = {}

    async def prepare_workflow_stream(self, workflow_id: UUID) -> str:
        stream_token = str(uuid.uuid4())
        self._streams[stream_token] = {
            'workflow_id': workflow_id,
            'status': 'pending',
            'result': [],
            'created_at': datetime.utcnow(),
            'expires_at': datetime.utcnow() + timedelta(minutes=30)  # 30 minute expiration
        }
        # Clean up expired tokens
        self._cleanup_expired_tokens()
        return stream_token
    
    def _cleanup_expired_tokens(self):
        """Remove expired stream tokens to prevent memory leak"""
        current_time = datetime.utcnow()
        expired_tokens = [
            token for token, data in self._streams.items()
            if 'expires_at' in data and data['expires_at'] < current_time
        ]
        for token in expired_tokens:
            del self._streams[token]
            logger.debug(f"Cleaned up expired stream token: {token}")

    def get_stream_data(self, stream_token: str) -> Optional[Dict]:
        stream_data = self._streams.get(stream_token)
        if stream_data and 'expires_at' in stream_data:
            if datetime.utcnow() > stream_data['expires_at']:
                # Token has expired
                del self._streams[stream_token]
                logger.warning(f"Stream token {stream_token} has expired")
                return None
        return stream_data

    def _update_stream_data(self, stream_token: str, result: Dict):
        if stream_token in self._streams:
            if 'result' not in self._streams[stream_token]:
                self._streams[stream_token]['result'] = []
            self._streams[stream_token]['result'].append(result)

    async def execute_workflow(self, workflow_id: UUID, user_input: dict, stream_token: str):
        db: Session = SessionLocal()
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

            # Extract dynamic inputs from user_input
            dynamic_file_ids = user_input.get("file_ids", [])
            dynamic_asset_ids = user_input.get("asset_ids", [])
            dynamic_kb_ids = user_input.get("knowledge_base_ids", [])
            
            logger.info(
                "Dynamic input received: file_ids=%s, asset_ids=%s, knowledge_base_ids=%s",
                dynamic_file_ids,
                dynamic_asset_ids,
                dynamic_kb_ids
            )
            
            # Merge dynamic assets with workflow's fixed assets
            all_asset_ids = [asset.id for asset in workflow.assets] if workflow.assets else []
            all_kb_ids = [kb.id for kb in workflow.knowledge_bases] if workflow.knowledge_bases else []
            
            # Add dynamic file IDs to assets (files uploaded are just assets)
            if dynamic_file_ids:
                all_asset_ids.extend(dynamic_file_ids)
                logger.info(f"Added {len(dynamic_file_ids)} uploaded files to workflow")
                logger.debug("File IDs being processed: %s", dynamic_file_ids)
                
            # Add dynamic asset selections
            if dynamic_asset_ids:
                all_asset_ids.extend(dynamic_asset_ids)
                logger.info(f"Added {len(dynamic_asset_ids)} selected assets to workflow")
                
            # Add dynamic KB selections
            if dynamic_kb_ids:
                all_kb_ids.extend(dynamic_kb_ids)
                logger.info(f"Added {len(dynamic_kb_ids)} selected knowledge bases to workflow")
            
            # Remove duplicates while preserving UUIDs
            all_asset_ids = list(set(all_asset_ids))
            all_kb_ids = list(set(all_kb_ids))

            # Build and stream a context summary so clients can verify what will be used
            try:
                # Fetch assets by id
                assets_by_id = []
                if all_asset_ids:
                    assets_by_id = db.query(models.Asset).filter(
                        models.Asset.id.in_(all_asset_ids)
                    ).all()

                # Also try storage_id for any dynamic file ids that are storage IDs
                storage_assets = []
                if dynamic_file_ids:
                    storage_assets = db.query(models.Asset).filter(
                        models.Asset.storage_id.in_(dynamic_file_ids)
                    ).all()

                # Merge and de-duplicate assets
                asset_meta_map = {}
                for a in assets_by_id + storage_assets:
                    asset_meta_map[str(a.id)] = {
                        "id": str(a.id),
                        "storage_id": str(a.storage_id) if a.storage_id else None,
                        "title": a.title,
                        "file_name": a.file_name,
                        "managed": bool(a.managed),
                    }

                # Fetch knowledge bases
                kb_meta = []
                if all_kb_ids:
                    kbs = db.query(models.KnowledgeBase).filter(
                        models.KnowledgeBase.id.in_(all_kb_ids)
                    ).all()
                    kb_meta = [{
                        "id": str(kb.id),
                        "title": kb.title,
                        "token_count": kb.token_count
                    } for kb in kbs]

                context_event = {
                    "type": "context",
                    "assets": list(asset_meta_map.values()),
                    "knowledge_bases": kb_meta,
                    "counts": {
                        "assets": len(asset_meta_map),
                        "knowledge_bases": len(kb_meta)
                    },
                    "sources": {
                        "dynamic_file_ids": [str(fid) for fid in (dynamic_file_ids or [])],
                        "dynamic_asset_ids": [str(aid) for aid in (dynamic_asset_ids or [])],
                        "dynamic_knowledge_base_ids": [str(kid) for kid in (dynamic_kb_ids or [])],
                        "workflow_asset_ids": [str(aid) for aid in ([asset.id for asset in (workflow.assets or [])])],
                        "workflow_knowledge_base_ids": [str(kid) for kid in ([kb.id for kb in (workflow.knowledge_bases or [])])]
                    }
                }
                self._update_stream_data(stream_token, context_event)
            except Exception as e:
                logger.warning(f"Unable to stream context summary: {e}")

            agents = []
            tasks = []

            for i, step in enumerate(sorted(workflow.steps, key=lambda x: x.position)):
                prompt_template = step.prompt_template
                chat_model = step.chat_model or default_chat_model
                persona = step.persona
                
                # Skip steps without a prompt template
                if not prompt_template:
                    logger.warning(f"Step {i+1} (position {step.position}) has no prompt template - skipping")
                    continue

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
                if i == 0 and "message" in user_input and user_input.get("message"):
                    description = user_input.get("message")
                elif prompt_template and prompt_template.prompt:
                    description = prompt_template.prompt
                else:
                    # Fallback description if both are None/empty
                    description = "Process this step"
                    logger.warning(f"Step {i+1} has no description from user input or prompt template, using fallback")

                # Use the merged lists for RAG content
                if all_asset_ids or all_kb_ids:
                    reference_content, content_tokens, used_rag = get_optimized_reference_content(
                        db=db,
                        query_text=description,
                        knowledge_base_ids=all_kb_ids if all_kb_ids else None,
                        asset_ids=all_asset_ids if all_asset_ids else None,
                        max_tokens=chat_model.max_tokens,
                        token_threshold=0.75
                    )
                    
                    if reference_content:
                        description = f"{description}\n\nReferenced Content:\n{reference_content}"

                # Create task
                task = Task(
                    description=description,
                    agent=agent,
                    expected_output="Quality writing",
                    callback=self._create_task_callback(stream_token, i + 1, description)
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

                # Include attached context identifiers for transparency
                step_info["attached_asset_ids"] = [str(aid) for aid in (all_asset_ids or [])]
                step_info["attached_knowledge_base_ids"] = [str(kid) for kid in (all_kb_ids or [])]
                step_info["type"] = "step"

                self._update_stream_data(stream_token, step_info)

            # Check if we have any valid tasks to execute
            if not tasks:
                logger.error("No valid tasks to execute in workflow")
                self._streams[stream_token]['status'] = 'error'
                self._streams[stream_token]['error'] = 'No valid tasks found in workflow. Please ensure workflow steps have prompt templates.'
                return
            
            # Execute workflow
            crew = Crew(
                agents=agents,
                tasks=tasks,
                process=Process.sequential if workflow.process_type == models.ProcessType.SEQUENTIAL.value else Process.hierarchical,
                verbose=True
            )

            result = await asyncio.to_thread(crew.kickoff)

            # Mark as completed
            self._streams[stream_token]['status'] = 'completed'
            # Add completion marker
            self._update_stream_data(stream_token, {"completed": True})
        except Exception as e:
            logger.error(f"Error in workflow execution: {str(e)}", exc_info=True)
            self._streams[stream_token]['status'] = 'error'
            # Sanitize error message to prevent information disclosure
            error_message = "Workflow execution failed"
            if "validation error" in str(e).lower():
                error_message = "Invalid workflow configuration. Please check your workflow setup."
            elif "rate limit" in str(e).lower():
                error_message = str(e)  # Rate limit messages are safe to expose
            self._streams[stream_token]['error'] = error_message
        finally:
            try:
                db.close()
            except Exception:
                pass

    def _create_task_callback(self, stream_token: str, step_num: int, step_prompt: str):
        """Create a callback function for task completion that updates stream data."""
        def task_callback(output):
            task_raw_output = output.raw if hasattr(output, 'raw') else str(output)
            task_result = {
                "step": str(step_num),
                "prompt": step_prompt,
                "response": task_raw_output
            }
            self._update_stream_data(stream_token, task_result)
            logger.info(f"Task {step_num} completed and result streamed")
        return task_callback

crew_service = CrewAIService()