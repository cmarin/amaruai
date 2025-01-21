from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Table, Text, Enum, UUID, BigInteger, TIMESTAMP, DateTime
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import text, func
import enum
import uuid

Base = declarative_base()

persona_category = Table('persona_category', Base.metadata,
    Column('persona_id', PGUUID(as_uuid=True), ForeignKey('persona.id'), primary_key=True),
    Column('category_id', Integer, ForeignKey('category.id'), primary_key=True)
)

persona_tag = Table('persona_tag', Base.metadata,
    Column('persona_id', PGUUID(as_uuid=True), ForeignKey('persona.id'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tag.id'), primary_key=True)
)

prompt_template_category = Table('prompt_template_category', Base.metadata,
    Column('prompt_template_id', PGUUID(as_uuid=True), ForeignKey('prompt_template.id'), primary_key=True),
    Column('category_id', Integer, ForeignKey('category.id'), primary_key=True)
)

prompt_template_tag = Table('prompt_template_tag', Base.metadata,
    Column('prompt_template_id', PGUUID(as_uuid=True), ForeignKey('prompt_template.id'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tag.id'), primary_key=True)
)

tool_persona = Table('tool_persona', Base.metadata,
    Column('tool_id', Integer, ForeignKey('tool.id'), primary_key=True),
    Column('persona_id', PGUUID(as_uuid=True), ForeignKey('persona.id'), primary_key=True)
)

# Define the association table before the model classes
knowledge_base_assets = Table(
    'knowledge_base_assets',
    Base.metadata,
    Column('knowledge_base_id', PGUUID(as_uuid=True), ForeignKey('knowledge_bases.id', ondelete='CASCADE'), primary_key=True),
    Column('asset_id', PGUUID(as_uuid=True), ForeignKey('assets.id', ondelete='CASCADE'), primary_key=True),
    Column('created_at', TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))
)

class ProcessType(enum.Enum):
    SEQUENTIAL = "SEQUENTIAL"
    HIERARCHICAL = "HIERARCHICAL"  # Ensure this matches the database value

class Persona(Base):
    __tablename__ = 'persona'

    id = Column(PGUUID(as_uuid=True), primary_key=True, server_default=text('uuid_generate_v4()'))
    role = Column(String, nullable=False)
    goal = Column(String, nullable=False)
    backstory = Column(String, nullable=False)
    allow_delegation = Column(Boolean, nullable=False)
    verbose = Column(Boolean, nullable=False)
    memory = Column(Boolean, nullable=False)
    avatar = Column(String)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))
    workflow_steps = relationship("WorkflowStep", back_populates="persona")

    tools = relationship("Tool", secondary=tool_persona, back_populates="personas")
    categories = relationship("Category", secondary=persona_category, back_populates="personas")
    tags = relationship("Tag", secondary=persona_tag, back_populates="personas")
    prompt_templates = relationship("PromptTemplate", back_populates="default_persona")

class Tool(Base):
    __tablename__ = 'tool'

    id = Column(PGUUID(as_uuid=True), primary_key=True, server_default=text('uuid_generate_v4()'))
    name = Column(String, nullable=False)

    personas = relationship("Persona", secondary=tool_persona, back_populates="tools")

class PromptTemplate(Base):
    __tablename__ = "prompt_template"

    id = Column(PGUUID(as_uuid=True), primary_key=True, server_default=text('uuid_generate_v4()'))
    title = Column(String)
    prompt = Column(String)
    is_complex = Column(Boolean)
    default_persona_id = Column(PGUUID(as_uuid=True), ForeignKey("persona.id"), nullable=True)

    workflow_steps = relationship("WorkflowStep", back_populates="prompt_template")
    categories = relationship("Category", secondary=prompt_template_category, back_populates="prompt_templates")
    tags = relationship("Tag", secondary=prompt_template_tag, back_populates="prompt_templates")
    default_persona = relationship("Persona", back_populates="prompt_templates")

class Category(Base):
    __tablename__ = "category"

    id = Column(Integer, primary_key=True)
    name = Column(String)
    personas = relationship("Persona", secondary=persona_category, back_populates="categories")
    prompt_templates = relationship("PromptTemplate", secondary=prompt_template_category, back_populates="categories")

class Tag(Base):
    __tablename__ = 'tag'

    id = Column(Integer, primary_key=True, index=True)  # Keep as Integer for now
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

    id = Column(PGUUID(as_uuid=True), primary_key=True, server_default=text('uuid_generate_v4()'))
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    process_type = Column(String)
    manager_chat_model_id = Column(Integer, ForeignKey("chat_model.id"), nullable=True)
    manager_persona_id = Column(PGUUID(as_uuid=True), ForeignKey("persona.id"), nullable=True)
    max_iterations = Column(Integer, nullable=True)
    
    steps = relationship(
        "WorkflowStep",
        order_by="WorkflowStep.position",
        cascade="all, delete-orphan"
    )

class WorkflowStep(Base):
    __tablename__ = "workflow_step"

    id = Column(PGUUID(as_uuid=True), primary_key=True, server_default=text('uuid_generate_v4()'))
    workflow_id = Column(PGUUID(as_uuid=True), ForeignKey("workflow.id"))
    position = Column(Integer)
    prompt_template_id = Column(PGUUID(as_uuid=True), ForeignKey("prompt_template.id"))
    chat_model_id = Column(Integer, ForeignKey("chat_model.id"))
    persona_id = Column(PGUUID(as_uuid=True), ForeignKey("persona.id"))

    workflow = relationship("Workflow", back_populates="steps")
    prompt_template = relationship("PromptTemplate", back_populates="workflow_steps")
    chat_model = relationship("ChatModel", back_populates="workflow_steps")
    persona = relationship("Persona", back_populates="workflow_steps")

class Asset(Base):
    __tablename__ = "assets"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String)
    file_name = Column(String)
    file_url = Column(String)
    file_type = Column(String)
    mime_type = Column(String)
    size = Column(Integer)
    content = Column(Text, nullable=True)
    token_count = Column(Integer, default=0)
    status = Column(String, nullable=True)
    managed = Column(Boolean, default=False)
    uploaded_by = Column(PGUUID(as_uuid=True), nullable=False)
    storage_id = Column(PGUUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    knowledge_bases = relationship(
        "KnowledgeBase",
        secondary=knowledge_base_assets,
        back_populates="assets"
    )

class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"

    id = Column(PGUUID(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()'))
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))
    token_count = Column(Integer, nullable=True, default=0)
    
    # Relationship with assets through the association table
    assets = relationship("Asset", secondary=knowledge_base_assets, back_populates="knowledge_bases")