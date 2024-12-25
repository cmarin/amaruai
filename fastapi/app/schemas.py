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

class WorkflowStepBase(BaseModel):
    prompt_template_id: str | int  # Allow both string and int
    chat_model_id: str | int
    persona_id: str | int

class WorkflowStepCreate(WorkflowStepBase):
    pass  # Remove position from here completely

class WorkflowStepUpdate(WorkflowStepBase):
    position: Optional[int] = None

class WorkflowStep(WorkflowStepBase):
    id: int
    workflow_id: int
    position: int
    prompt_template_id: int  # Override to require int
    chat_model_id: int      # Override to require int
    persona_id: int         # Override to require int

    class Config:
        from_attributes = True

class WorkflowBase(BaseModel):
    name: str
    description: Optional[str] = None
    process_type: str = "SEQUENTIAL"
    manager_chat_model_id: Optional[int] = None
    manager_persona_id: Optional[int] = None
    max_iterations: Optional[int] = None  # Make max_iterations optional

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

class ChatMessage(BaseModel):
    # Either a single message or a list of messages
    message: Optional[str] = Field(
        None,
        description="Single message if you're not passing a list of messages"
    )
    messages: Optional[List[Message]] = Field(
        None,
        description="List of chat messages"
    )
    model_id: Optional[int] = Field(None, description="ID of the chat model to use")
    persona_id: Optional[int] = Field(None, description="ID of the persona to use")
    user_id: Optional[str] = Field(None, description="ID of the user")
    files: List[FileInfo] = Field(default_factory=list, description="List of files to process")

    # -------------------- NEW FIELDS FOR MEMORY -------------------- #
    conversation_id: Optional[str] = Field(
        None,
        description="Unique conversation_id (UUID as str) sent by the client"
    )
    multi_conversation_id: Optional[str] = Field(
        None,
        description="Unique multi_conversation_id (UUID as str) sent by the client"
    )
    # --------------------------------------------------------------- #

    class Config:
        json_schema_extra = {
            "example": {
                "messages": [{"role": "user", "content": "Tell me a joke"}],
                "user_id": "user123",
                "files": [{"name": "doc.txt", "url": "https://..."}]
            }
        }

Workflow.update_forward_refs()
