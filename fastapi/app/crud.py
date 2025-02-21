from sqlalchemy.orm import Session, joinedload, load_only  # Add load_only to the import
from . import models, schemas
from sqlalchemy import desc, Enum as SQLAlchemyEnum, asc, func, cast
from fastapi import HTTPException
import logging
from uuid import UUID, uuid4
from typing import List
from .models import ProcessType  # Add this import
from sqlalchemy.dialects.postgresql import UUID as PGUUID

logger = logging.getLogger(__name__)

def get_persona(db: Session, persona_id: UUID):
    return db.query(models.Persona).filter(models.Persona.id == persona_id).first()

def get_personas(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Persona).offset(skip).limit(limit).all()

def create_persona(db: Session, persona: schemas.PersonaCreate):
    try:
        # Create the persona
        create_data = {
            "role": persona.role,
            "goal": persona.goal,
            "backstory": persona.backstory,
            "allow_delegation": persona.allow_delegation,
            "verbose": persona.verbose,
            "memory": persona.memory,
            "avatar": persona.avatar,
        }
        
        # Only add temperature if it's provided
        if persona.temperature is not None:
            create_data["temperature"] = float(persona.temperature)
            
        db_persona = models.Persona(**create_data)
        db.add(db_persona)
        
        # Handle categories
        for category_id in persona.category_ids:
            if category_id:
                category = db.query(models.Category).filter(models.Category.id == category_id).first()
                if category:
                    db_persona.categories.append(category)
        
        # Handle tags by name
        tags = get_or_create_tags(db, persona.tags)
        db_persona.tags = tags
        
        # Handle tools
        for tool_id in persona.tools:
            tool = db.query(models.Tool).filter(models.Tool.id == tool_id).first()
            if tool:
                db_persona.tools.append(tool)
        
        db.commit()
        db.refresh(db_persona)
        return db_persona
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating persona: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

def update_persona(db: Session, persona_id: UUID, persona: schemas.PersonaUpdate):
    try:
        db_persona = db.query(models.Persona).filter(models.Persona.id == persona_id).first()
        if db_persona:
            # Update basic fields
            update_data = persona.dict(
                exclude={'category_ids', 'tags', 'tools'}, 
                exclude_unset=True,
                exclude_none=True
            )
            for key, value in update_data.items():
                setattr(db_persona, key, value)
            
            # Update categories if provided
            if persona.category_ids is not None:
                db_persona.categories = []
                valid_category_ids = [
                    cat_id for cat_id in persona.category_ids 
                    if cat_id is not None
                ]
                for category_id in valid_category_ids:
                    category = db.query(models.Category).filter(
                        models.Category.id == category_id
                    ).first()
                    if category:
                        db_persona.categories.append(category)
            
            # Update tags if provided
            if persona.tags is not None:
                tags = get_or_create_tags(db, persona.tags)
                db_persona.tags = tags
            
            # Update tools if provided
            if persona.tools is not None:
                db_persona.tools = []
                for tool_id in persona.tools:
                    tool = db.query(models.Tool).filter(models.Tool.id == tool_id).first()
                    if tool:
                        db_persona.tools.append(tool)
            
            db.commit()
            db.refresh(db_persona)
            
        return db_persona
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

def delete_persona(db: Session, persona_id: UUID):
    db_persona = db.query(models.Persona).filter(models.Persona.id == persona_id).first()
    if db_persona:
        db.delete(db_persona)
        db.commit()
    return db_persona

def get_tool(db: Session, tool_id: UUID):
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

def update_tool(tool_id: UUID, db: Session, tool: schemas.ToolCreate):
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

def delete_tool(db: Session, tool_id: UUID):
    db_tool = db.query(models.Tool).filter(models.Tool.id == tool_id).first()
    if db_tool:
        db.delete(db_tool)
        db.commit()
    return db_tool

def get_category(db: Session, category_id: UUID):
    return db.query(models.Category).filter(models.Category.id == category_id).first()

def get_categories(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Category).offset(skip).limit(limit).all()

def create_category(db: Session, category: schemas.CategoryCreate):
    db_category = models.Category(**category.dict())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

def update_category(db: Session, category_id: UUID, category: schemas.CategoryCreate):
    db_category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if db_category:
        for key, value in category.dict().items():
            setattr(db_category, key, value)
        db.commit()
        db.refresh(db_category)
    return db_category

def delete_category(db: Session, category_id: UUID):
    db_category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if db_category:
        db.delete(db_category)
        db.commit()
    return db_category

def get_tag(db: Session, tag_id: UUID):
    return db.query(models.Tag).filter(models.Tag.id == tag_id).first()

def get_tags(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Tag).offset(skip).limit(limit).all()

def create_tag(db: Session, tag: schemas.TagCreate):
    db_tag = models.Tag(**tag.dict())
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    return db_tag

def update_tag(db: Session, tag_id: UUID, tag: schemas.TagCreate):
    db_tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
    if db_tag:
        for key, value in tag.dict().items():
            setattr(db_tag, key, value)
        db.commit()
        db.refresh(db_tag)
    return db_tag

def delete_tag(db: Session, tag_id: UUID):
    db_tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
    if db_tag:
        db.delete(db_tag)
        db.commit()
    return db_tag

def get_prompt_template(db: Session, prompt_template_id: UUID):
    return db.query(models.PromptTemplate).filter(models.PromptTemplate.id == prompt_template_id).first()

def get_prompt_templates(db: Session, skip: int = 0, limit: int = 100):
    """
    Get all prompt templates with pagination
    """
    logger.debug("Fetching prompt templates")
    templates = db.query(models.PromptTemplate).offset(skip).limit(limit).all()
    logger.debug(f"Found {len(templates)} templates")
    return templates

def get_or_create_tags(db: Session, tag_names: List[str]) -> List[models.Tag]:
    """Get existing tags or create new ones if they don't exist."""
    tags = []
    for name in tag_names:
        # Try to find existing tag
        tag = db.query(models.Tag).filter(models.Tag.name == name).first()
        if not tag:
            # Create new tag if it doesn't exist
            tag = models.Tag(name=name)
            db.add(tag)
            db.flush()  # Flush to get the ID but don't commit yet
        tags.append(tag)
    return tags

def create_prompt_template(db: Session, prompt_template: schemas.PromptTemplateCreate):
    try:
        # Create the prompt template
        create_data = {
            "title": prompt_template.title,
            "prompt": prompt_template.prompt,
            "is_complex": prompt_template.is_complex,
            "default_persona_id": prompt_template.default_persona_id,
            "default_chat_model_id": prompt_template.default_chat_model_id,
            "created_by": prompt_template.created_by,
        }
        
        db_prompt_template = models.PromptTemplate(**create_data)
        db.add(db_prompt_template)
        
        # Handle categories
        for category_id in prompt_template.category_ids:
            if category_id:
                category = db.query(models.Category).filter(models.Category.id == category_id).first()
                if category:
                    db_prompt_template.categories.append(category)
        
        # Handle tags
        tags = get_or_create_tags(db, prompt_template.tags)
        db_prompt_template.tags = tags
        
        db.commit()
        db.refresh(db_prompt_template)
        return db_prompt_template
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating prompt template: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

def update_prompt_template(db: Session, prompt_template_id: UUID, prompt_template: schemas.PromptTemplateUpdate):
    try:
        db_prompt_template = db.query(models.PromptTemplate).filter(
            models.PromptTemplate.id == prompt_template_id
        ).first()
        
        if db_prompt_template:
            # Update basic fields
            update_data = prompt_template.dict(
                exclude={'category_ids', 'tags'},
                exclude_unset=True,
                exclude_none=True
            )
            for key, value in update_data.items():
                setattr(db_prompt_template, key, value)
            
            # Update categories if provided
            if prompt_template.category_ids is not None:
                db_prompt_template.categories = []
                valid_category_ids = [
                    cat_id for cat_id in prompt_template.category_ids 
                    if cat_id is not None
                ]
                for category_id in valid_category_ids:
                    category = db.query(models.Category).filter(
                        models.Category.id == category_id
                    ).first()
                    if category:
                        db_prompt_template.categories.append(category)
            
            # Update tags if provided
            if prompt_template.tags is not None:
                tags = get_or_create_tags(db, prompt_template.tags)
                db_prompt_template.tags = tags
            
            # Update timestamp
            db_prompt_template.updated_at = func.now()
            
            db.commit()
            db.refresh(db_prompt_template)
            
        return db_prompt_template
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

def delete_prompt_template(db: Session, prompt_template_id: UUID):
    db_prompt_template = db.query(models.PromptTemplate).filter(models.PromptTemplate.id == prompt_template_id).first()
    if db_prompt_template:
        db.delete(db_prompt_template)
        db.commit()
    return db_prompt_template

def get_chat_model(db: Session, chat_model_id: UUID):
    return db.query(models.ChatModel).filter(models.ChatModel.id == chat_model_id).first()

def get_chat_models(db: Session, user_id: UUID, skip: int = 0, limit: int = 100):
    """Get all chat models and mark which ones are favorited by the user."""
    # First get the user's favorite chat models
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    favorite_model_ids = {
        model.id for model in user.favorite_chat_models
    }

    # Get all chat models
    chat_models = db.query(models.ChatModel).offset(skip).limit(limit).all()

    # Mark favorites
    for model in chat_models:
        setattr(model, 'is_favorited', model.id in favorite_model_ids)

    return chat_models

def create_chat_model(db: Session, chat_model: schemas.ChatModelCreate):
    db_chat_model = models.ChatModel(**chat_model.dict())
    db.add(db_chat_model)
    db.commit()
    db.refresh(db_chat_model)
    return db_chat_model

def update_chat_model(db: Session, chat_model_id: UUID, chat_model: schemas.ChatModelUpdate):
    db_chat_model = db.query(models.ChatModel).filter(models.ChatModel.id == chat_model_id).first()
    if db_chat_model:
        update_data = chat_model.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_chat_model, key, value)
        db.commit()
        db.refresh(db_chat_model)
    return db_chat_model

def delete_chat_model(db: Session, chat_model_id: UUID):
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

def get_workflows(db: Session, skip: int = 0, limit: int = 100):
    try:
        # Query workflows with all relationships in a single query
        workflows = db.query(models.Workflow).options(
            joinedload(models.Workflow.steps)
        ).order_by(
            models.Workflow.id
        ).offset(skip).limit(limit).all()
        
        # Load relationships separately to avoid type casting issues
        for workflow in workflows:
            for step in workflow.steps:
                db.query(models.PromptTemplate).filter(
                    models.PromptTemplate.id == step.prompt_template_id
                ).first()
                db.query(models.ChatModel).filter(
                    models.ChatModel.id == step.chat_model_id
                ).first()
                db.query(models.Persona).filter(
                    models.Persona.id == step.persona_id
                ).first()
        
        return workflows
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error getting workflows: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def get_workflow(db: Session, workflow_id: UUID):
    try:
        # Query workflow with eager loading of assets and knowledge bases
        workflow = db.query(models.Workflow).options(
            joinedload(models.Workflow.steps),
            joinedload(models.Workflow.assets),
            joinedload(models.Workflow.knowledge_bases)
        ).filter(
            models.Workflow.id == workflow_id
        ).first()
        
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        # Load relationships for each step
        for step in workflow.steps:
            db.query(models.PromptTemplate).filter(
                models.PromptTemplate.id == step.prompt_template_id
            ).first()
            db.query(models.ChatModel).filter(
                models.ChatModel.id == step.chat_model_id
            ).first()
            db.query(models.Persona).filter(
                models.Persona.id == step.persona_id
            ).first()
            
        return workflow
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error getting workflow: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def create_workflow(db: Session, workflow: schemas.WorkflowCreate):
    workflow_data = workflow.dict(exclude={'asset_ids', 'knowledge_base_ids'})
    workflow_data['process_type'] = workflow_data['process_type'].value

    db_workflow = models.Workflow(**workflow_data)

    # Add assets if provided
    if workflow.asset_ids:
        for asset_id in workflow.asset_ids:
            asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
            if asset:
                db_workflow.assets.append(asset)

    # Add knowledge bases if provided
    if workflow.knowledge_base_ids:
        for kb_id in workflow.knowledge_base_ids:
            kb = db.query(models.KnowledgeBase).filter(models.KnowledgeBase.id == kb_id).first()
            if kb:
                db_workflow.knowledge_bases.append(kb)

    db.add(db_workflow)
    db.commit()
    db.refresh(db_workflow)
    return db_workflow

def update_workflow(db: Session, workflow_id: UUID, workflow: schemas.WorkflowUpdate):
    db_workflow = db.query(models.Workflow).filter(models.Workflow.id == workflow_id).first()
    if db_workflow:
        update_data = workflow.dict(exclude_unset=True, exclude={'steps', 'asset_ids', 'knowledge_base_ids'})
        for key, value in update_data.items():
            setattr(db_workflow, key, value)
            
        # Update steps if provided
        if workflow.steps is not None:
            db_workflow.steps = []
            for step_data in workflow.steps:
                step = models.WorkflowStep(
                    workflow_id=workflow_id,
                    prompt_template_id=step_data.prompt_template_id,
                    chat_model_id=step_data.chat_model_id,
                    persona_id=step_data.persona_id,
                    position=step_data.position
                )
                db_workflow.steps.append(step)

        # Update assets if provided
        if workflow.asset_ids is not None:
            db_workflow.assets = []
            for asset_id in workflow.asset_ids:
                asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
                if asset:
                    db_workflow.assets.append(asset)

        # Update knowledge bases if provided
        if workflow.knowledge_base_ids is not None:
            db_workflow.knowledge_bases = []
            for kb_id in workflow.knowledge_base_ids:
                kb = db.query(models.KnowledgeBase).filter(models.KnowledgeBase.id == kb_id).first()
                if kb:
                    db_workflow.knowledge_bases.append(kb)
        
        db.commit()
        db.refresh(db_workflow)
    return db_workflow

def delete_workflow(db: Session, workflow_id: UUID):
    # First, delete all associated workflow steps
    db.query(models.WorkflowStep).filter(models.WorkflowStep.workflow_id == workflow_id).delete(synchronize_session=False)
    
    # Then, delete the workflow
    db_workflow = db.query(models.Workflow).filter(models.Workflow.id == workflow_id).first()
    if db_workflow:
        db.delete(db_workflow)
        db.commit()
    return db_workflow

def get_workflow_step(db: Session, step_id: UUID):
    return db.query(models.WorkflowStep).filter(models.WorkflowStep.id == step_id).first()

def get_workflow_steps(db: Session, workflow_id: UUID):
    return db.query(models.WorkflowStep).filter(
        models.WorkflowStep.workflow_id == workflow_id
    ).order_by(models.WorkflowStep.position).all()

def create_workflow_step(db: Session, workflow_id: UUID, step: schemas.WorkflowStepCreate):
    try:
        # Get all existing steps for this workflow
        existing_steps = db.query(models.WorkflowStep).filter(
            models.WorkflowStep.workflow_id == workflow_id
        ).order_by(models.WorkflowStep.position).all()
        
        # Calculate next position if not provided
        position = step.position if step.position is not None else len(existing_steps)
        
        # Create new step
        db_step = models.WorkflowStep(
            workflow_id=workflow_id,
            prompt_template_id=step.prompt_template_id,
            chat_model_id=step.chat_model_id,
            persona_id=step.persona_id,
            position=position
        )
        
        db.add(db_step)
        db.commit()
        db.refresh(db_step)
        return db_step
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating workflow step: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def update_workflow_step(db: Session, step_id: UUID, step: schemas.WorkflowStepUpdate):
    db_step = db.query(models.WorkflowStep).filter(models.WorkflowStep.id == step_id).first()
    if db_step:
        update_data = step.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_step, key, value)
        db.commit()
        db.refresh(db_step)
    return db_step

def delete_workflow_step(db: Session, step_id: UUID):
    db_step = db.query(models.WorkflowStep).filter(models.WorkflowStep.id == step_id).first()
    if db_step:
        db.delete(db_step)
        db.commit()
    return db_step

def reorder_workflow_step(db: Session, step_id: UUID, new_position: int):
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

def move_workflow_step_up(db: Session, step_id: UUID):
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

def move_workflow_step_down(db: Session, step_id: UUID):
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
    logger = logging.getLogger(__name__)
    logger.info(f"Searching for asset with file_url: {file_url}")
        
    # Perform the actual query
    asset = db.query(models.Asset).filter(models.Asset.file_url == file_url).first()
    if asset:
        # Create a copy of the asset info without the content
        asset_info = {
            'id': asset.id,
            'title': asset.title,
            'file_name': asset.file_name,
            'file_type': asset.file_type,
            'size': asset.size,
            'token_count': asset.token_count,
            'file_url': asset.file_url,
            'status': asset.status,
            'managed': asset.managed
        }
        logger.info(f"Found asset: {asset_info}")
    else:
        logger.info("No matching asset found")
    
    return asset

def get_asset(db: Session, asset_id: UUID):
    logger = logging.getLogger(__name__)
    logger.info(f"Attempting to get asset with ID: {asset_id}")
    try:
        asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
        if asset:
            # Create a copy of the asset info without the content
            asset_info = {
                'id': asset.id,
                'title': asset.title,
                'file_name': asset.file_name,
                'file_type': asset.file_type,
                'size': asset.size,
                'token_count': asset.token_count,
                'file_url': asset.file_url,
                'status': asset.status,
                'managed': asset.managed
            }
            logger.info(f"Found asset: {asset_info}")
        else:
            logger.warning(f"No asset found with ID: {asset_id}")
            # Let's also check if the asset exists with a different case
            all_assets = db.query(models.Asset).all()
            logger.info(f"All asset IDs in database: {[str(a.id) for a in all_assets]}")
        return asset
    except Exception as e:
        logger.error(f"Error getting asset: {str(e)}", exc_info=True)
        return None

def update_asset_status(db: Session, asset_id: UUID, status: str):
    """
    Update the status of an asset.
    
    Args:
        db (Session): The database session
        asset_id (UUID): The ID of the asset to update
        status (str): The new status to set
        
    Returns:
        models.Asset: The updated asset or None if not found
    """
    try:
        asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
        if asset:
            asset.status = status
            db.commit()
            db.refresh(asset)
            logger.info(f"Updated status of asset {asset_id} to {status}")
            return asset
        else:
            logger.warning(f"No asset found with ID: {asset_id}")
            return None
    except Exception as e:
        logger.error(f"Error updating asset status: {str(e)}", exc_info=True)
        db.rollback()
        raise

def get_knowledge_base(db: Session, knowledge_base_id: UUID):
    return db.query(models.KnowledgeBase).filter(models.KnowledgeBase.id == knowledge_base_id).first()

def get_knowledge_bases(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.KnowledgeBase).offset(skip).limit(limit).all()

def create_knowledge_base(db: Session, knowledge_base: schemas.KnowledgeBaseCreate):
    db_knowledge_base = models.KnowledgeBase(
        title=knowledge_base.title,
        description=knowledge_base.description
    )
    db.add(db_knowledge_base)
    db.commit()
    db.refresh(db_knowledge_base)
    
    # Add associated assets
    for asset_id in knowledge_base.asset_ids:
        asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
        if asset:
            db_knowledge_base.assets.append(asset)
    
    db.commit()
    db.refresh(db_knowledge_base)
    return db_knowledge_base

def update_knowledge_base(db: Session, knowledge_base_id: UUID, knowledge_base: schemas.KnowledgeBaseUpdate):
    db_knowledge_base = db.query(models.KnowledgeBase).filter(models.KnowledgeBase.id == knowledge_base_id).first()
    if db_knowledge_base:
        update_data = knowledge_base.dict(exclude_unset=True, exclude={'asset_ids'})
        for key, value in update_data.items():
            setattr(db_knowledge_base, key, value)
        
        if knowledge_base.asset_ids is not None:
            db_knowledge_base.assets = []
            for asset_id in knowledge_base.asset_ids:
                asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
                if asset:
                    db_knowledge_base.assets.append(asset)
        
        db_knowledge_base.updated_at = func.now()
        db.commit()
        db.refresh(db_knowledge_base)
    return db_knowledge_base

def delete_knowledge_base(db: Session, knowledge_base_id: UUID):
    db_knowledge_base = db.query(models.KnowledgeBase).filter(models.KnowledgeBase.id == knowledge_base_id).first()
    if db_knowledge_base:
        db.delete(db_knowledge_base)
        db.commit()
    return db_knowledge_base

def get_assets(db: Session, skip: int = 0, limit: int = 10, managed: bool = True):
    """
    Get assets sorted by creation date (newest first) with optional filtering by managed status.
    
    Args:
        db (Session): The database session
        skip (int): Number of records to skip (default: 0)
        limit (int): Maximum number of records to return (default: 10)
        managed (bool): Filter by managed status (default: True)
    """
    query = db.query(models.Asset)
    
    # Filter by managed status
    query = query.filter(models.Asset.managed == managed)
    
    # Sort by creation date, newest first
    query = query.order_by(desc(models.Asset.created_at))
    
    # Apply pagination
    return query.offset(skip).limit(limit).all()


def delete_asset(db: Session, asset_id: UUID):
    """
    Delete an asset from the database.
    
    Args:
        db (Session): The database session
        asset_id (UUID): The ID of the asset to delete
        
    Returns:
        models.Asset: The deleted asset or None if not found
    """
    try:
        asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
        if asset:
            # Remove any knowledge base associations first
            asset.knowledge_bases = []
            db.delete(asset)
            db.commit()
            logger.info(f"Successfully deleted asset {asset_id}")
            return asset
        else:
            logger.warning(f"No asset found with ID: {asset_id}")
            return None
    except Exception as e:
        logger.error(f"Error deleting asset: {str(e)}", exc_info=True)
        db.rollback()
        raise

def add_assets_to_knowledge_base(db: Session, knowledge_base_id: UUID, asset_ids: List[UUID]):
    """
    Add one or more assets to a knowledge base.
    
    Args:
        db (Session): The database session
        knowledge_base_id (UUID): The ID of the knowledge base
        asset_ids (List[UUID]): List of asset IDs to add
        
    Returns:
        models.KnowledgeBase: The updated knowledge base or None if not found
    """
    try:
        db_knowledge_base = db.query(models.KnowledgeBase).filter(
            models.KnowledgeBase.id == knowledge_base_id
        ).first()
        
        if db_knowledge_base:
            # Get the assets to add
            for asset_id in asset_ids:
                asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
                if asset and asset not in db_knowledge_base.assets:
                    db_knowledge_base.assets.append(asset)
            
            db_knowledge_base.updated_at = func.now()
            db.commit()
            db.refresh(db_knowledge_base)
            logger.info(f"Successfully added assets to knowledge base {knowledge_base_id}")
            
        return db_knowledge_base
        
    except Exception as e:
        logger.error(f"Error adding assets to knowledge base: {str(e)}", exc_info=True)
        db.rollback()
        raise

def remove_assets_from_knowledge_base(db: Session, knowledge_base_id: UUID, asset_ids: List[UUID]):
    """
    Remove one or more assets from a knowledge base.
    
    Args:
        db (Session): The database session
        knowledge_base_id (UUID): The ID of the knowledge base
        asset_ids (List[UUID]): List of asset IDs to remove
        
    Returns:
        models.KnowledgeBase: The updated knowledge base or None if not found
    """
    try:
        db_knowledge_base = db.query(models.KnowledgeBase).filter(
            models.KnowledgeBase.id == knowledge_base_id
        ).first()
        
        if db_knowledge_base:
            # Remove the specified assets
            db_knowledge_base.assets = [
                asset for asset in db_knowledge_base.assets 
                if asset.id not in asset_ids
            ]
            
            db_knowledge_base.updated_at = func.now()
            db.commit()
            db.refresh(db_knowledge_base)
            logger.info(f"Successfully removed assets from knowledge base {knowledge_base_id}")
            
        return db_knowledge_base
        
    except Exception as e:
        logger.error(f"Error removing assets from knowledge base: {str(e)}", exc_info=True)
        db.rollback()
        raise

def get_knowledge_base_assets(db: Session, knowledge_base_id: UUID):
    """
    Get all assets associated with a knowledge base.
    """
    kb = db.query(models.KnowledgeBase).filter(models.KnowledgeBase.id == knowledge_base_id).first()
    if kb:
        return kb.assets
    return []

def get_chat_history(db: Session, persona_id: UUID):
    """
    Get chat history for a specific persona.
    
    Args:
        db (Session): Database session
        persona_id (UUID): ID of the persona
        
    Returns:
        List of chat messages for the persona
    """
    # Implement the actual chat history retrieval logic here
    return []

def toggle_prompt_template_favorite(
    db: Session,
    prompt_template_id: UUID,
    user_id: str,  # Can be email or UUID
    favorite: bool = True
) -> models.PromptTemplate:
    """Toggle favorite status of a prompt template for a user."""
    prompt_template = db.query(models.PromptTemplate).filter(
        models.PromptTemplate.id == prompt_template_id
    ).first()
    
    if not prompt_template:
        raise HTTPException(status_code=404, detail="Prompt template not found")
    
    # Handle email-based user_id
    if '@' in str(user_id):
        user = db.query(models.User).filter(models.User.email == user_id).first()
    else:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if favorite:
        if prompt_template not in user.favorite_templates:
            user.favorite_templates.append(prompt_template)
    else:
        if prompt_template in user.favorite_templates:
            user.favorite_templates.remove(prompt_template)
    
    db.commit()
    db.refresh(prompt_template)
    
    # Add is_favorited field
    setattr(prompt_template, 'is_favorited', favorite)
    return prompt_template

def get_favorite_prompt_templates(db: Session, user_id: str) -> List[models.PromptTemplate]:
    """
    Get all prompt templates favorited by a user.
    Now accepts either UUID or email as user_id.
    """
    # First get the user by email if user_id is an email
    if '@' in str(user_id):  # Simple check to determine if it's an email
        user = db.query(models.User).filter(models.User.email == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user_id = user.id
    else:
        # If it's not an email, assume it's already a UUID
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

    # Get the favorite templates
    return (
        db.query(models.PromptTemplate)
        .join(models.prompt_template_favorites)
        .filter(models.prompt_template_favorites.c.user_id == user_id)
        .all()
    )

def toggle_chat_model_favorite(
    db: Session,
    chat_model_id: UUID,
    user_id: UUID,
    favorite: bool = True
) -> models.ChatModel:
    """Toggle favorite status of a chat model for a user."""
    chat_model = db.query(models.ChatModel).filter(
        models.ChatModel.id == chat_model_id
    ).first()
    
    if not chat_model:
        raise HTTPException(status_code=404, detail="Chat model not found")
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if favorite:
        if chat_model not in user.favorite_chat_models:
            user.favorite_chat_models.append(chat_model)
    else:
        if chat_model in user.favorite_chat_models:
            user.favorite_chat_models.remove(chat_model)
    
    db.commit()
    db.refresh(chat_model)
    
    # Add is_favorited field
    setattr(chat_model, 'is_favorited', favorite)
    return chat_model

def get_favorite_chat_models(db: Session, user_id: UUID) -> List[models.ChatModel]:
    """Get all chat models favorited by a user."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return (
        db.query(models.ChatModel)
        .join(models.chat_model_favorites)
        .filter(models.chat_model_favorites.c.user_id == user_id)
        .all()
    )

def get_assets_by_ids(db: Session, asset_ids: List[UUID]) -> List[models.Asset]:
    """
    Get multiple assets by their IDs.
    
    Args:
        db: Database session
        asset_ids: List of asset UUIDs to retrieve
        
    Returns:
        List of Asset objects
    """
    if not asset_ids:
        return []
        
    return db.query(models.Asset).filter(
        models.Asset.id.in_(asset_ids)
    ).all()
