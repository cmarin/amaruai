from sqlalchemy.orm import Session, joinedload, load_only  # Add load_only to the import
from . import models, schemas
from sqlalchemy import desc, Enum as SQLAlchemyEnum, asc, func  # Add func to the import
from fastapi import HTTPException
import logging

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

def get_workflow(db: Session, workflow_id: int):
    return db.query(models.Workflow).options(
        joinedload(models.Workflow.steps).joinedload(models.WorkflowStep.prompt_template),
        joinedload(models.Workflow.steps).joinedload(models.WorkflowStep.chat_model),
        joinedload(models.Workflow.steps).joinedload(models.WorkflowStep.persona)
    ).filter(models.Workflow.id == workflow_id).first()

def get_workflows(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Workflow).offset(skip).limit(limit).all()

def create_workflow(db: Session, workflow: schemas.WorkflowCreate):
    # Create a dictionary of the data, converting the enum to string
    workflow_data = workflow.dict()
    workflow_data['process_type'] = workflow_data['process_type'].value  # Convert enum to string

    db_workflow = models.Workflow(
        name=workflow.name,
        description=workflow.description,
        process_type=workflow_data['process_type'],
        manager_chat_model_id=workflow.manager_chat_model_id,
        manager_persona_id=workflow.manager_persona_id,
        max_iterations=workflow.max_iterations or 1  # Ensure a default value
    )
    db.add(db_workflow)
    db.commit()
    db.refresh(db_workflow)
    return db_workflow

def update_workflow(db: Session, workflow_id: int, workflow: schemas.WorkflowUpdate):
    db_workflow = db.query(models.Workflow).filter(models.Workflow.id == workflow_id).first()
    if db_workflow:
        # Update workflow fields
        update_data = workflow.dict(exclude_unset=True, exclude={'steps'})
        for key, value in update_data.items():
            setattr(db_workflow, key, value)
        
        # Update step positions if steps are provided
        if hasattr(workflow, 'steps') and workflow.steps:
            # Get existing steps
            existing_steps = {step.id: step for step in db_workflow.steps}
            
            # Update or create steps
            for position, step_data in enumerate(workflow.steps):
                logging.info(f"Processing step {step_data.id} at position {position}")
                
                db_step = db.query(models.WorkflowStep).filter(
                    models.WorkflowStep.id == step_data.id,
                    models.WorkflowStep.workflow_id == workflow_id
                ).first()
                
                if db_step:
                    logging.info(f"Updating step {db_step.id} position to {position}")
                    # Update step position and other fields
                    db_step.position = position
                    if hasattr(step_data, 'prompt_template_id'):
                        db_step.prompt_template_id = int(step_data.prompt_template_id)
                    if hasattr(step_data, 'chat_model_id'):
                        db_step.chat_model_id = int(step_data.chat_model_id)
                    if hasattr(step_data, 'persona_id'):
                        db_step.persona_id = int(step_data.persona_id)
                    
                    # Remove from existing steps dict to track which ones to delete
                    existing_steps.pop(db_step.id, None)
            
            # Delete any steps that weren't in the update
            for step in existing_steps.values():
                logging.info(f"Deleting step {step.id}")
                db.delete(step)

        db.commit()
        db.refresh(db_workflow)
        
        # Verify positions after update
        steps = db.query(models.WorkflowStep).filter(
            models.WorkflowStep.workflow_id == workflow_id
        ).order_by(models.WorkflowStep.position).all()
        
        logging.info("Final step positions:")
        for step in steps:
            logging.info(f"Step {step.id}: position {step.position}")
            
    return db_workflow

def delete_workflow(db: Session, workflow_id: int):
    # First, delete all associated workflow steps
    db.query(models.WorkflowStep).filter(models.WorkflowStep.workflow_id == workflow_id).delete(synchronize_session=False)
    
    # Then, delete the workflow
    db_workflow = db.query(models.Workflow).filter(models.Workflow.id == workflow_id).first()
    if db_workflow:
        db.delete(db_workflow)
        db.commit()
    return db_workflow

def get_workflow_step(db: Session, step_id: int):
    return db.query(models.WorkflowStep).filter(models.WorkflowStep.id == step_id).first()

def get_workflow_steps(db: Session, workflow_id: int):
    return db.query(models.WorkflowStep).filter(models.WorkflowStep.workflow_id == workflow_id).order_by(models.WorkflowStep.position).all()

def create_workflow_step(db: Session, workflow_id: int, step: schemas.WorkflowStepCreate):
    try:
        # Get all existing steps for this workflow
        existing_steps = db.query(models.WorkflowStep).filter(
            models.WorkflowStep.workflow_id == workflow_id
        ).order_by(models.WorkflowStep.position).all()
        
        # Calculate next position
        next_position = len(existing_steps)
        
        logging.info(f"Creating new step at position {next_position}")

        # Create new step
        db_step = models.WorkflowStep(
            workflow_id=workflow_id,
            prompt_template_id=int(step.prompt_template_id),
            chat_model_id=int(step.chat_model_id),
            persona_id=int(step.persona_id),
            position=next_position
        )
        db.add(db_step)
        db.commit()
        db.refresh(db_step)
        
        logging.info(f"Created step {db_step.id} at position {db_step.position}")
        return db_step
    except Exception as e:
        db.rollback()
        logging.error(f"Error creating workflow step: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def update_workflow_step(db: Session, step_id: int, step: schemas.WorkflowStepUpdate):
    db_step = db.query(models.WorkflowStep).filter(models.WorkflowStep.id == step_id).first()
    if db_step:
        update_data = step.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_step, key, value)
        db.commit()
        db.refresh(db_step)
    return db_step

def delete_workflow_step(db: Session, step_id: int):
    step = db.query(models.WorkflowStep).filter(models.WorkflowStep.id == step_id).first()
    if step:
        db.delete(step)
        db.commit()
    return step

def reorder_workflow_step(db: Session, step_id: int, new_position: int):
    db_step = db.query(models.WorkflowStep).filter(models.WorkflowStep.id == step_id).first()
    if db_step:
        old_position = db_step.position
        if new_position > old_position:
            # Moving down, shift intermediate steps up
            db.query(models.WorkflowStep).filter(
                models.WorkflowStep.workflow_id == db_step.workflow_id,
                models.WorkflowStep.position > old_position,
                models.WorkflowStep.position <= new_position
            ).update({models.WorkflowStep.position: models.WorkflowStep.position - 1})
        elif new_position < old_position:
            # Moving up, shift intermediate steps down
            db.query(models.WorkflowStep).filter(
                models.WorkflowStep.workflow_id == db_step.workflow_id,
                models.WorkflowStep.position >= new_position,
                models.WorkflowStep.position < old_position
            ).update({models.WorkflowStep.position: models.WorkflowStep.position + 1})
        
        db_step.position = new_position
        db.commit()
    return db_step

def move_workflow_step_up(db: Session, step_id: int):
    step = db.query(models.WorkflowStep).filter(models.WorkflowStep.id == step_id).first()
    if step and step.position > 1:
        previous_step = db.query(models.WorkflowStep).filter(
            models.WorkflowStep.workflow_id == step.workflow_id,
            models.WorkflowStep.position == step.position - 1
        ).first()
        if previous_step:
            step.position, previous_step.position = previous_step.position, step.position
            db.commit()
    return step

def move_workflow_step_down(db: Session, step_id: int):
    step = db.query(models.WorkflowStep).filter(models.WorkflowStep.id == step_id).first()
    if step:
        next_step = db.query(models.WorkflowStep).filter(
            models.WorkflowStep.workflow_id == step.workflow_id,
            models.WorkflowStep.position == step.position + 1
        ).first()
        if next_step:
            step.position, next_step.position = next_step.position, step.position
            db.commit()
    return step

def get_asset_by_file_url(db: Session, file_url: str):
    """
    Get an asset by its file_url.
    The file_url should be in the format: chats/user_id/uuid/filename.txt
    """
    return db.query(models.Asset).filter(models.Asset.file_url == file_url).first()
