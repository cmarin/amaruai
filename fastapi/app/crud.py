from sqlalchemy.orm import Session, joinedload, load_only  # Add load_only to the import
from . import models, schemas

def get_persona(db: Session, persona_id: int):
    return db.query(models.Persona).filter(models.Persona.id == persona_id).first()

def get_personas(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Persona).offset(skip).limit(limit).all()

def create_persona(db: Session, persona: schemas.PersonaCreate):
    db_persona = models.Persona(**persona.dict(exclude={'category_ids', 'tag_ids'}))
    db.add(db_persona)
    db.commit()
    db.refresh(db_persona)
    
    for category_id in persona.category_ids:
        category = db.query(models.Category).filter(models.Category.id == category_id).first()
        if category:
            db_persona.categories.append(category)
    
    for tag_id in persona.tag_ids:
        tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
        if tag:
            db_persona.tags.append(tag)
    
    db.commit()
    db.refresh(db_persona)
    return db_persona

def update_persona(db: Session, persona_id: int, persona: schemas.PersonaUpdate):
    db_persona = db.query(models.Persona).filter(models.Persona.id == persona_id).first()
    if db_persona:
        update_data = persona.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_persona, key, value)
        
        if persona.category_ids is not None:
            db_persona.categories = []
            for category_id in persona.category_ids:
                category = db.query(models.Category).filter(models.Category.id == category_id).first()
                if category:
                    db_persona.categories.append(category)
        
        if persona.tag_ids is not None:
            db_persona.tags = []
            for tag_id in persona.tag_ids:
                tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
                if tag:
                    db_persona.tags.append(tag)
        
        db.commit()
        db.refresh(db_persona)
    return db_persona

def delete_persona(db: Session, persona_id: int):
    db_persona = db.query(models.Persona).filter(models.Persona.id == persona_id).first()
    if db_persona:
        db.delete(db_persona)
        db.commit()
    return db_persona

def get_tool(db: Session, tool_id: int):
    return db.query(models.Tool).options(joinedload(models.Tool.personas)).filter(models.Tool.id == tool_id).first()

def get_tools(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Tool).offset(skip).limit(limit).all()

def create_tool(db: Session, tool: schemas.ToolCreate):
    db_tool = models.Tool(name=tool.name)
    db.add(db_tool)
    db.commit()
    db.refresh(db_tool)

    for persona_id in tool.persona_ids:
        persona = db.query(models.Persona).filter(models.Persona.id == persona_id).first()
        if persona:
            db_tool.personas.append(persona)

    db.commit()
    db.refresh(db_tool)
    return db_tool

def update_tool(db: Session, tool_id: int, tool: schemas.ToolCreate):
    db_tool = db.query(models.Tool).filter(models.Tool.id == tool_id).first()
    if db_tool:
        db_tool.name = tool.name
        db_tool.personas = []
        for persona_id in tool.persona_ids:
            persona = db.query(models.Persona).filter(models.Persona.id == persona_id).first()
            if persona:
                db_tool.personas.append(persona)
        db.commit()
        db.refresh(db_tool)
    return db_tool

def delete_tool(db: Session, tool_id: int):
    db_tool = db.query(models.Tool).filter(models.Tool.id == tool_id).first()
    if db_tool:
        db.delete(db_tool)
        db.commit()
    return db_tool

def get_category(db: Session, category_id: int):
    return db.query(models.Category).filter(models.Category.id == category_id).first()

def get_categories(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Category).offset(skip).limit(limit).all()

def create_category(db: Session, category: schemas.CategoryCreate):
    db_category = models.Category(**category.dict())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

def update_category(db: Session, category_id: int, category: schemas.CategoryCreate):
    db_category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if db_category:
        for key, value in category.dict().items():
            setattr(db_category, key, value)
        db.commit()
        db.refresh(db_category)
    return db_category

def delete_category(db: Session, category_id: int):
    db_category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if db_category:
        db.delete(db_category)
        db.commit()
    return db_category

def get_tag(db: Session, tag_id: int):
    return db.query(models.Tag).filter(models.Tag.id == tag_id).first()

def get_tags(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Tag).offset(skip).limit(limit).all()

def create_tag(db: Session, tag: schemas.TagCreate):
    db_tag = models.Tag(**tag.dict())
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    return db_tag

def update_tag(db: Session, tag_id: int, tag: schemas.TagCreate):
    db_tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
    if db_tag:
        for key, value in tag.dict().items():
            setattr(db_tag, key, value)
        db.commit()
        db.refresh(db_tag)
    return db_tag

def delete_tag(db: Session, tag_id: int):
    db_tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
    if db_tag:
        db.delete(db_tag)
        db.commit()
    return db_tag

def get_prompt_template(db: Session, prompt_template_id: int):
    return db.query(models.PromptTemplate).filter(models.PromptTemplate.id == prompt_template_id).first()

def get_prompt_templates(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.PromptTemplate).offset(skip).limit(limit).all()

def create_prompt_template(db: Session, prompt_template: schemas.PromptTemplateCreate):
    db_prompt_template = models.PromptTemplate(**prompt_template.dict(exclude={'category_ids', 'tag_ids'}))
    db.add(db_prompt_template)
    db.commit()
    db.refresh(db_prompt_template)
    
    for category_id in prompt_template.category_ids:
        category = db.query(models.Category).filter(models.Category.id == category_id).first()
        if category:
            db_prompt_template.categories.append(category)
    
    for tag_id in prompt_template.tag_ids:
        tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
        if tag:
            db_prompt_template.tags.append(tag)
    
    db.commit()
    db.refresh(db_prompt_template)
    return db_prompt_template

def update_prompt_template(db: Session, prompt_template_id: int, prompt_template: schemas.PromptTemplateCreate):
    db_prompt_template = db.query(models.PromptTemplate).filter(models.PromptTemplate.id == prompt_template_id).first()
    if db_prompt_template:
        update_data = prompt_template.dict(exclude={'category_ids', 'tag_ids'})
        for key, value in update_data.items():
            setattr(db_prompt_template, key, value)
        
        db_prompt_template.categories = []
        for category_id in prompt_template.category_ids:
            category = db.query(models.Category).filter(models.Category.id == category_id).first()
            if category:
                db_prompt_template.categories.append(category)
        
        db_prompt_template.tags = []
        for tag_id in prompt_template.tag_ids:
            tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
            if tag:
                db_prompt_template.tags.append(tag)
        
        db.commit()
        db.refresh(db_prompt_template)
    return db_prompt_template

def delete_prompt_template(db: Session, prompt_template_id: int):
    db_prompt_template = db.query(models.PromptTemplate).filter(models.PromptTemplate.id == prompt_template_id).first()
    if db_prompt_template:
        db.delete(db_prompt_template)
        db.commit()
    return db_prompt_template

def get_chat_model(db: Session, chat_model_id: int):
    return db.query(models.ChatModel).filter(models.ChatModel.id == chat_model_id).first()

def get_chat_models(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.ChatModel).options(load_only(
        models.ChatModel.id,
        models.ChatModel.name,
        models.ChatModel.model,
        models.ChatModel.provider,
        models.ChatModel.description,
        models.ChatModel.api_key,
        models.ChatModel.default
    )).offset(skip).limit(limit).all()

def create_chat_model(db: Session, chat_model: schemas.ChatModelCreate):
    db_chat_model = models.ChatModel(**chat_model.dict())
    db.add(db_chat_model)
    db.commit()
    db.refresh(db_chat_model)
    return db_chat_model

def update_chat_model(db: Session, chat_model_id: int, chat_model: schemas.ChatModelCreate):
    db_chat_model = db.query(models.ChatModel).filter(models.ChatModel.id == chat_model_id).first()
    if db_chat_model:
        for key, value in chat_model.dict().items():
            setattr(db_chat_model, key, value)
        db.commit()
        db.refresh(db_chat_model)
    return db_chat_model

def delete_chat_model(db: Session, chat_model_id: int):
    db_chat_model = db.query(models.ChatModel).filter(models.ChatModel.id == chat_model_id).first()
    if db_chat_model:
        db.delete(db_chat_model)
        db.commit()
    return db_chat_model

def get_chat_model_by_name(db: Session, name: str):
    return db.query(models.ChatModel).filter(models.ChatModel.name == name).first()

def get_chat_model_by_model(db: Session, model: str):
    return db.query(models.ChatModel).filter(models.ChatModel.model == model).first()

def get_default_chat_model(db: Session):
    return db.query(models.ChatModel).filter(models.ChatModel.default == True).first()
