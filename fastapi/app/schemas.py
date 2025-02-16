from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from enum import Enum
from uuid import UUID
from datetime import datetime
from pydantic import validator

class ToolBase(BaseModel):
    name: str

class ToolCreate(ToolBase):
    persona_ids: List[UUID] = []

class Tool(ToolBase):
    id: UUID
    persona_ids: List[UUID] = []

    class Config:
        from_attributes = True

class CategoryBase(BaseModel):
    name: str

class CategoryCreate(CategoryBase):
    pass

class Category(CategoryBase):
    id: UUID

    class Config:
        from_attributes = True

class TagBase(BaseModel):
    name: str

class TagCreate(TagBase):
    pass

class Tag(TagBase):
    id: UUID

    class Config:
        from_attributes = True

class PromptTemplateBase(BaseModel):
    title: str
    prompt: str
    is_complex: bool

class PromptTemplateCreate(BaseModel):
    title: str
    prompt: str
    is_complex: bool = False
    default_persona_id: Optional[UUID] = None
    category_ids: List[Optional[UUID]] = []
    tags: List[str] = []
    created_by: Optional[UUID] = None

    @validator('category_ids', pre=True)
    def empty_list_if_none(cls, v):
        if v is None or (isinstance(v, list) and len(v) == 1 and v[0] is None):
            return []
        return v

class PromptTemplate(PromptTemplateBase):
    id: UUID
    default_persona_id: Optional[UUID] = None
    categories: List[Category] = []
    tags: List[Tag] = []
    created_by: UUID
    is_favorited: bool = False  # Will be computed based on current user

    class Config:
        from_attributes = True

class PromptTemplateUpdate(BaseModel):
    title: Optional[str] = None
    prompt: Optional[str] = None
    is_complex: Optional[bool] = None
    default_persona_id: Optional[UUID] = None
    category_ids: Optional[List[Optional[UUID]]] = None
    tags: Optional[List[str]] = None

    @validator('category_ids', pre=True)
    def validate_category_ids(cls, v):
        if v is None:
            return []
        # Filter out empty strings and None values
        return [
            UUID(cat_id) if isinstance(cat_id, str) and cat_id 
            else cat_id 
            for cat_id in v 
            if cat_id not in (None, "")
        ]

class ChatModelBase(BaseModel):
    name: str
    model: str
    provider: str | None = None
    description: str = ""
    api_key: str | None = None
    default: bool = False
    max_tokens: int | None = None

    @validator('description', pre=True, always=True)
    def set_default_description(cls, v, values):
        """Set a default description based on model if none provided"""
        if not v and 'model' in values:
            return f"Model: {values['model']}"
        return v

class ChatModelCreate(ChatModelBase):
    @validator('provider', pre=True, always=True)
    def set_provider_from_model(cls, v, values):
        """Set provider to openrouter if not explicitly provided"""
        if not v:
            return "openrouter"
        return v

class ChatModelUpdate(BaseModel):
    name: str | None = None
    model: str | None = None
    provider: str | None = None
    description: str | None = None
    api_key: str | None = None
    default: bool | None = None
    max_tokens: int | None = None

class ChatModel(ChatModelBase):
    id: UUID
    is_favorited: bool = False  # Will be computed based on current user

    class Config:
        from_attributes = True

class PersonaBase(BaseModel):
    role: str
    goal: str
    backstory: str
    allow_delegation: bool
    verbose: bool
    memory: bool
    avatar: Optional[str] = None
    temperature: Optional[float] = Field(
        None, 
        ge=0.0, 
        le=1.0, 
        description="Temperature value between 0 and 1"
    )

    @validator('temperature')
    def validate_temperature(cls, v):
        if v is not None:
            try:
                v = float(v)  # Convert to float if possible
                if v < 0.0 or v > 1.0:
                    raise ValueError("Temperature must be between 0 and 1")
                return v
            except (TypeError, ValueError):
                raise ValueError("Temperature must be a valid number between 0 and 1")
        return v

class PersonaCreate(PersonaBase):
    category_ids: List[Optional[UUID]] = []  
    tags: List[str] = []  
    tools: List[UUID] = []
    description: Optional[str] = None  # Add this if it's in your payload
    prompt_templates: Optional[List[Any]] = []  # Add this if it's in your payload

    @validator('category_ids', pre=True)
    def validate_category_ids(cls, v):
        if v is None:
            return []
        # Filter out empty strings and None values
        return [
            UUID(cat_id) if isinstance(cat_id, str) and cat_id 
            else cat_id 
            for cat_id in v 
            if cat_id not in (None, "")
        ]

    class Config:
        extra = "ignore"  # This will ignore extra fields in the payload

class PersonaUpdate(BaseModel):
    role: Optional[str] = None
    goal: Optional[str] = None
    backstory: Optional[str] = None
    allow_delegation: Optional[bool] = None
    verbose: Optional[bool] = None
    memory: Optional[bool] = None
    avatar: Optional[str] = None
    temperature: Optional[float] = Field(None, ge=0.0, le=1.0)
    category_ids: Optional[List[Optional[UUID]]] = None
    tags: Optional[List[str]] = None  
    tools: Optional[List[UUID]] = None
    description: Optional[str] = None
    prompt_templates: Optional[List[Any]] = None

    class Config:
        extra = "ignore"

    @validator('temperature')
    def validate_temperature(cls, v):
        if v is not None:
            try:
                v = float(v)
                if v < 0.0 or v > 1.0:
                    raise ValueError("Temperature must be between 0 and 1")
                return v
            except (TypeError, ValueError):
                raise ValueError("Temperature must be a valid number between 0 and 1")
        return v

class Persona(PersonaBase):
    id: UUID
    tools: List[Tool] = []
    categories: List[Category] = []
    tags: List[Tag] = []
    prompt_templates: List[PromptTemplate] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ProcessType(str, Enum):
    SEQUENTIAL = "SEQUENTIAL"
    PARALLEL = "HIERARCHICAL"

class WorkflowStepBase(BaseModel):
    prompt_template_id: Optional[UUID] = None
    chat_model_id: Optional[UUID] = None
    persona_id: Optional[UUID] = None

    @validator('prompt_template_id', 'chat_model_id', 'persona_id', pre=True)
    def convert_to_uuid(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            return UUID(v)
        elif isinstance(v, UUID):
            return v
        return v

class WorkflowStepCreate(BaseModel):
    prompt_template_id: UUID
    chat_model_id: UUID
    persona_id: UUID
    position: Optional[int] = None

    @validator('prompt_template_id', 'chat_model_id', 'persona_id', pre=True)
    def convert_to_uuid(cls, v):
        if v is None:
            raise ValueError("ID cannot be None for new workflow steps")
        if isinstance(v, str):
            return UUID(v)
        elif isinstance(v, UUID):
            return v
        return v

class WorkflowStepUpdate(BaseModel):
    prompt_template_id: UUID
    chat_model_id: UUID
    persona_id: UUID
    position: int

    @validator('prompt_template_id', 'chat_model_id', 'persona_id', pre=True)
    def convert_to_uuid(cls, v):
        if v is None:
            raise ValueError("ID cannot be None for workflow step updates")
        if isinstance(v, str):
            return UUID(v)
        elif isinstance(v, UUID):
            return v
        return v

class WorkflowStep(WorkflowStepBase):
    id: UUID
    workflow_id: UUID
    position: int
    prompt_template: Optional[PromptTemplate] = None
    chat_model: Optional[ChatModel] = None
    persona: Optional[Persona] = None

    class Config:
        from_attributes = True

class WorkflowBase(BaseModel):
    name: str
    description: Optional[str] = None
    process_type: str = "SEQUENTIAL"
    manager_chat_model_id: Optional[UUID] = None
    manager_persona_id: Optional[UUID] = None
    max_iterations: Optional[int] = None

    @validator('manager_chat_model_id', 'manager_persona_id', pre=True)
    def convert_to_uuid(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            return UUID(v)
        elif isinstance(v, UUID):
            return v
        return v

class WorkflowCreate(WorkflowBase):
    process_type: ProcessType
    asset_ids: Optional[List[UUID]] = []
    knowledge_base_ids: Optional[List[UUID]] = []

class WorkflowUpdate(WorkflowBase):
    steps: Optional[List[WorkflowStepUpdate]] = None
    asset_ids: Optional[List[UUID]] = None
    knowledge_base_ids: Optional[List[UUID]] = None

class Workflow(WorkflowBase):
    id: UUID
    steps: List[WorkflowStep] = []
    assets: List[Asset] = []
    knowledge_bases: List[KnowledgeBase] = []

    @property
    def effective_max_iterations(self) -> Optional[int]:
        if self.process_type == ProcessType.HIERARCHICAL.value:
            return self.max_iterations or 1
        return None

    class Config:
        from_attributes = True

class WorkflowStepResult(BaseModel):
    step: int
    prompt: str
    response: str

class WorkflowExecutionResult(BaseModel):
    results: List[WorkflowStepResult]

class Message(BaseModel):
    role: str = Field(..., description="The role of the sender (e.g. user, assistant, system)")
    content: str = Field(..., description="The content of the message")

class FileInfo(BaseModel):
    name: str = Field(..., description="Name of the file")
    url: str = Field(..., description="URL of the file")

class ChatData(BaseModel):
    messages: Optional[List[Message]] = None
    message: Optional[str] = None
    conversation_id: Optional[UUID] = None
    model: Optional[str] = None
    user_id: Optional[UUID] = None

class ChatMessage(BaseModel):
    multi_conversation_id: Optional[UUID] = None
    message: Optional[str] = None
    messages: Optional[List[Message]] = None
    data: Optional[Dict[str, Any]] = None
    model_id: Optional[UUID] = None
    persona_id: Optional[UUID] = None
    conversation_id: Optional[UUID] = None
    knowledge_base_ids: Optional[List[UUID]] = []
    asset_ids: Optional[List[UUID]] = []
    files: Optional[List[FileInfo]] = []
    user_id: Optional[UUID] = None
    web: Optional[bool] = False

    @validator('conversation_id', pre=True)
    def validate_conversation_id(cls, v):
        if v is None:
            return None
        if isinstance(v, UUID):
            return v
        if isinstance(v, str):
            try:
                return UUID(v)
            except ValueError:
                return v  
        return v

    @validator('user_id', pre=True)
    def validate_user_id(cls, v):
        if v is None:
            return None
        if isinstance(v, UUID):
            return v
        if isinstance(v, str):
            try:
                return UUID(v)
            except ValueError:
                return v  
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "messages": [{"role": "user", "content": "Tell me a joke"}],
                "user_id": "user123",
                "files": [{"name": "doc.txt", "url": "https://..."}],
                "knowledge_base_ids": ["uuid1", "uuid2"],
                "asset_ids": ["uuid3"]
            }
        }

class AssetBase(BaseModel):
    title: str
    file_name: str
    file_url: str
    file_type: str
    mime_type: str
    size: int
    content: Optional[str] = None
    token_count: Optional[int] = 0
    status: Optional[str] = None
    managed: Optional[bool] = False

class AssetCreate(AssetBase):
    uploaded_by: UUID
    storage_id: Optional[UUID] = None

class Asset(AssetBase):
    id: UUID
    uploaded_by: UUID
    storage_id: Optional[UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class KnowledgeBaseBase(BaseModel):
    title: str
    description: str
    token_count: Optional[int] = 0

class KnowledgeBaseCreate(KnowledgeBaseBase):
    asset_ids: List[UUID] = []

class KnowledgeBaseUpdate(KnowledgeBaseBase):
    asset_ids: Optional[List[UUID]] = None

class KnowledgeBase(KnowledgeBaseBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    assets: List[Asset] = []

    class Config:
        from_attributes = True

class AssetIds(BaseModel):
    asset_ids: List[UUID]

class WorkflowExecuteInput(BaseModel):
    message: Optional[str] = None
    knowledge_base_ids: Optional[List[UUID]] = None
    asset_ids: Optional[List[UUID]] = None

Workflow.update_forward_refs()
