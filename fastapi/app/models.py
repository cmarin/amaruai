from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Table, Text, Enum
from sqlalchemy.orm import relationship
from app.database import Base
import enum

persona_category = Table('persona_category', Base.metadata,
    Column('persona_id', Integer, ForeignKey('persona.id'), primary_key=True),
    Column('category_id', Integer, ForeignKey('category.id'), primary_key=True)
)

persona_tag = Table('persona_tag', Base.metadata,
    Column('persona_id', Integer, ForeignKey('persona.id'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tag.id'), primary_key=True)
)

prompt_template_category = Table('prompt_template_category', Base.metadata,
    Column('prompt_template_id', Integer, ForeignKey('prompt_template.id'), primary_key=True),
    Column('category_id', Integer, ForeignKey('category.id'), primary_key=True)
)

prompt_template_tag = Table('prompt_template_tag', Base.metadata,
    Column('prompt_template_id', Integer, ForeignKey('prompt_template.id'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tag.id'), primary_key=True)
)

tool_persona = Table('tool_persona', Base.metadata,
    Column('tool_id', Integer, ForeignKey('tool.id'), primary_key=True),
    Column('persona_id', Integer, ForeignKey('persona.id'), primary_key=True)
)

class ProcessType(enum.Enum):
    SEQUENTIAL = "sequential"
    PARALLEL = "parallel"

class Persona(Base):
    __tablename__ = 'persona'

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String, nullable=False)
    goal = Column(String, nullable=False)
    backstory = Column(String, nullable=False)
    allow_delegation = Column(Boolean, nullable=False)
    verbose = Column(Boolean, nullable=False)
    memory = Column(Boolean, nullable=False)
    avatar = Column(String)
    is_favorite = Column(Boolean, default=False)
    workflow_steps = relationship("WorkflowStep", back_populates="persona")

    tools = relationship("Tool", secondary=tool_persona, back_populates="personas")
    categories = relationship("Category", secondary=persona_category, back_populates="personas")
    tags = relationship("Tag", secondary=persona_tag, back_populates="personas")
    prompt_templates = relationship("PromptTemplate", back_populates="default_persona")

class Tool(Base):
    __tablename__ = 'tool'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)

    personas = relationship("Persona", secondary=tool_persona, back_populates="tools")

class PromptTemplate(Base):
    __tablename__ = 'prompt_template'

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    prompt = Column(String, nullable=False)
    is_complex = Column(Boolean, nullable=False)
    default_persona_id = Column(Integer, ForeignKey('persona.id'), nullable=True)
    workflow_steps = relationship("WorkflowStep", back_populates="prompt_template")

    default_persona = relationship("Persona", back_populates="prompt_templates")
    categories = relationship("Category", secondary=prompt_template_category, back_populates="prompt_templates")
    tags = relationship("Tag", secondary=prompt_template_tag, back_populates="prompt_templates")

class Category(Base):
    __tablename__ = 'category'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)

    personas = relationship("Persona", secondary=persona_category, back_populates="categories")
    prompt_templates = relationship("PromptTemplate", secondary=prompt_template_category, back_populates="categories")

class Tag(Base):
    __tablename__ = 'tag'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)

    personas = relationship("Persona", secondary=persona_tag, back_populates="tags")
    prompt_templates = relationship("PromptTemplate", secondary=prompt_template_tag, back_populates="tags")

class ChatModel(Base):
    __tablename__ = "chat_model"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    model = Column(String)
    provider = Column(String)
    description = Column(String, nullable=True)
    api_key = Column(String, nullable=True)
    default = Column(Boolean, default=False)
    workflow_steps = relationship("WorkflowStep", back_populates="chat_model")

class Workflow(Base):
    __tablename__ = "workflow"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text, nullable=True)
    process_type = Column(Enum(ProcessType), default=ProcessType.SEQUENTIAL)

    steps = relationship("WorkflowStep",
                         back_populates="workflow",
                         order_by="WorkflowStep.order")

class WorkflowStep(Base):
    __tablename__ = "workflow_step"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflow.id"))
    order = Column(Integer, nullable=False)
    prompt_template_id = Column(Integer, ForeignKey("prompt_template.id"))
    chat_model_id = Column(Integer, ForeignKey("chat_model.id"))
    persona_id = Column(Integer, ForeignKey("persona.id"))

    workflow = relationship("Workflow", back_populates="steps")
    prompt_template = relationship("PromptTemplate", back_populates="workflow_steps")
    chat_model = relationship("ChatModel", back_populates="workflow_steps")
    persona = relationship("Persona", back_populates="workflow_steps")
