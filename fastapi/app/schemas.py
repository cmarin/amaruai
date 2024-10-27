from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum

class ToolBase(BaseModel):
    name: str

class ToolCreate(ToolBase):
    persona_ids: List[int] = []

class Tool(ToolBase):
    id: int
    persona_ids: List[int] = []

    class Config:
        from_attributes = True  # Replace orm_mode = True with this

class CategoryBase(BaseModel):
    name: str

class CategoryCreate(CategoryBase):
    pass

class Category(CategoryBase):
    id: int

    class Config:
        from_attributes = True  # Replace orm_mode = True with this

class TagBase(BaseModel):
    name: str

class TagCreate(TagBase):
    pass

class Tag(TagBase):
    id: int

    class Config:
        from_attributes = True  # Replace orm_mode = True with this

class PromptTemplateBase(BaseModel):
    title: str
    prompt: str
    is_complex: bool

class PromptTemplateCreate(PromptTemplateBase):
    default_persona_id: Optional[int] = None
    category_ids: List[int] = []
    tag_ids: List[int] = []

class PromptTemplate(PromptTemplateBase):
    id: int
    default_persona_id: Optional[int]  # Make this optional
    categories: List[Category] = []
    tags: List[Tag] = []

    class Config:
        from_attributes = True  # Use from_attributes instead of orm_mode

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

class PersonaUpdate(PersonaBase):
    category_ids: Optional[List[int]] = None
    tag_ids: Optional[List[int]] = None

class Persona(PersonaBase):
    id: int
    tools: List[Tool] = []
    categories: List[Category] = []
    tags: List[Tag] = []
    prompt_templates: List[PromptTemplate] = []

    class Config:
        from_attributes = True  # Use from_attributes instead of orm_mode

class ProcessType(str, Enum):
    SEQUENTIAL = "SEQUENTIAL"
    PARALLEL = "HIERARCHICAL"

class WorkflowBase(BaseModel):
    name: str
    description: Optional[str] = None
    process_type: ProcessType = ProcessType.SEQUENTIAL

class WorkflowCreate(WorkflowBase):
    pass

class WorkflowUpdate(WorkflowBase):
    pass

class Workflow(WorkflowBase):
    id: int
    steps: List["WorkflowStep"] = []

    class Config:
        from_attributes = True

class WorkflowStepBase(BaseModel):
    prompt_template_id: int
    chat_model_id: int
    persona_id: int

class WorkflowStepCreate(WorkflowStepBase):
    pass

class WorkflowStepUpdate(WorkflowStepBase):
    pass

class WorkflowStep(WorkflowStepBase):
    id: int
    workflow_id: int
    position: int

    class Config:
        from_attributes = True

class WorkflowStepResult(BaseModel):
    step: int
    prompt: str
    response: str

class WorkflowExecutionResult(BaseModel):
    results: List[WorkflowStepResult]

class ChatResponse(BaseModel):
    """Schema for chat response"""
    content: str
    conversation_id: str
    user_id: str
    model: Optional[str] = None
    persona_id: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

Workflow.update_forward_refs()
