from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Table
from sqlalchemy.orm import relationship
from app.database import Base

persona_category = Table('persona_category', Base.metadata,
    Column('persona_id', Integer, ForeignKey('persona.id'), primary_key=True),
    Column('category_id', Integer, ForeignKey('category.id'), primary_key=True)
)

persona_tag = Table('persona_tag', Base.metadata,
    Column('persona_id', Integer, ForeignKey('persona.id'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tag.id'), primary_key=True)
)

prompt_template_category = Table('prompt_template_category', Base.metadata,
    Column('prompt_template_id', Integer, ForeignKey('prompttemplate.id'), primary_key=True),
    Column('category_id', Integer, ForeignKey('category.id'), primary_key=True)
)

prompt_template_tag = Table('prompt_template_tag', Base.metadata,
    Column('prompt_template_id', Integer, ForeignKey('prompttemplate.id'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tag.id'), primary_key=True)
)

tool_persona = Table('tool_persona', Base.metadata,
    Column('tool_id', Integer, ForeignKey('tool.id'), primary_key=True),
    Column('persona_id', Integer, ForeignKey('persona.id'), primary_key=True)
)

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
    __tablename__ = 'prompttemplate'

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    prompt = Column(String, nullable=False)
    is_complex = Column(Boolean, nullable=False)
    default_persona_id = Column(Integer, ForeignKey('persona.id'), nullable=True)  # Allow null values

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
    __tablename__ = "chat_models"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    model = Column(String)
    provider = Column(String)
    description = Column(String, nullable=True)
    api_key = Column(String, nullable=True)
    default = Column(Boolean, default=False)
