from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum
from uuid import UUID
from datetime import datetime

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
    id: int

    class Config:
        from_attributes = True

class TagBase(BaseModel):
    name: str

class TagCreate(TagBase):
    pass

class Tag(TagBase):
    id: int

    class Config:
        from_attributes = True

class PromptTemplateBase(BaseModel):
    title: str
    prompt: str
    is_complex: bool

class PromptTemplateCreate(PromptTemplateBase):
    default_persona_id: Optional[UUID] = None
    category_ids: List[int] = []
    tag_ids: List[int] = []

class PromptTemplate(PromptTemplateBase):
    id: int
    default_persona_id: Optional[UUID] = None
    categories: List[Category] = []
    tags: List[Tag] = []

    class Config:
        from_attributes = True

class ChatModelBase(BaseModel):
    name: str
    model: str  # Add this line
    provider: str  # Add this line if it's not already there
    description: str | None = None
    api_key: str | None = None
    default: bool = False  # Add this line if it's not already there

class ChatModelCreate(ChatModelBase):
    pass

class ChatModel(ChatModelBase):
    id: int

    class Config:
        from_attributes = True  # Use from_attributes instead of orm_mode

class PersonaBase(BaseModel):
    role: str
    goal: str
    backstory: str
    allow_delegation: bool
    verbose: bool
    memory: bool
    avatar: Optional[str] = None

class PersonaCreate(PersonaBase):
    category_ids: List[int] = []
    tag_ids: List[int] = []
    tools: List[int] = []

class PersonaUpdate(PersonaBase):
    category_ids: Optional[List[int]] = None
    tag_ids: Optional[List[int]] = None
    tools: Optional[List[int]] = None

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
    prompt_template_id: int
    chat_model_id: int
    persona_id: UUID

class WorkflowStepCreate(WorkflowStepBase):
    pass

class WorkflowStepUpdate(WorkflowStepBase):
    position: Optional[int] = None

class WorkflowStep(WorkflowStepBase):
    id: UUID
    workflow_id: UUID
    position: int

    class Config:
        from_attributes = True

class WorkflowBase(BaseModel):
    name: str
    description: Optional[str] = None
    process_type: str = "SEQUENTIAL"
    manager_chat_model_id: Optional[int] = None
    manager_persona_id: Optional[UUID] = None
    max_iterations: Optional[int] = None

class WorkflowCreate(WorkflowBase):
    process_type: ProcessType

class WorkflowUpdate(WorkflowBase):
    steps: Optional[List[WorkflowStepUpdate]] = None

class Workflow(WorkflowBase):
    id: int
    steps: List[WorkflowStep] = []

    @property
    def effective_max_iterations(self) -> Optional[int]:
        # Return max_iterations only if process_type is HIERARCHICAL
        if self.process_type == ProcessType.HIERARCHICAL.value:
            return self.max_iterations or 1  # Default to 1 for hierarchical workflows
        return None  # Return None for sequential workflows

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
    message: Optional[str] = None
    messages: Optional[List[Message]] = None
    data: Optional[ChatData] = None
    model_id: Optional[int] = None
    persona_id: Optional[UUID] = None
    conversation_id: Optional[UUID] = None
    knowledge_base_ids: List[UUID] = []
    asset_ids: List[UUID] = []
    files: List[FileInfo] = []
    user_id: Optional[UUID] = None

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

Workflow.update_forward_refs()
