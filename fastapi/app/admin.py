import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from app import crud, models, schemas
from app.database import get_db
from fastapi.templating import Jinja2Templates

admin_router = APIRouter()
templates = Jinja2Templates(directory="app/templates")

@admin_router.get("/", response_class=HTMLResponse)
async def admin_dashboard(request: Request, db: Session = Depends(get_db)):
    personas = crud.get_personas(db)
    tools = crud.get_tools(db)
    prompt_templates = crud.get_prompt_templates(db)
    categories = crud.get_categories(db)
    tags = crud.get_tags(db)
    chat_models = crud.get_chat_models(db)

    return templates.TemplateResponse("admin/dashboard.html", {
        "request": request,
        "personas": personas,
        "tools": tools,
        "prompt_templates": prompt_templates,
        "categories": categories,
        "tags": tags,
        "chat_models": chat_models
    })

@admin_router.get("/personas/{persona_id}", response_class=HTMLResponse)
async def view_persona(request: Request, persona_id: int, db: Session = Depends(get_db)):
    persona = crud.get_persona(db, persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    return templates.TemplateResponse("admin/persona_detail.html", {
        "request": request,
        "persona": persona
    })

@admin_router.get("/personas/{persona_id}/edit", response_class=HTMLResponse)
async def edit_persona(request: Request, persona_id: int, db: Session = Depends(get_db)):
    persona = crud.get_persona(db, persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    categories = crud.get_categories(db)
    tags = crud.get_tags(db)
    return templates.TemplateResponse("admin/persona_edit.html", {
        "request": request,
        "persona": persona,
        "categories": categories,
        "tags": tags
    })

@admin_router.post("/personas/{persona_id}/edit", response_class=HTMLResponse)
async def update_persona(request: Request, persona_id: int, db: Session = Depends(get_db)):
    form = await request.form()
    persona_data = {
        "role": form.get("role"),
        "goal": form.get("goal"),
        "backstory": form.get("backstory"),
        "allow_delegation": form.get("allow_delegation") == "on",
        "verbose": form.get("verbose") == "on",
        "memory": form.get("memory") == "on",
        "avatar": form.get("avatar"),
        "is_favorite": form.get("is_favorite") == "on",
        "category_ids": [int(id) for id in form.getlist("category_ids")],
        "tag_ids": [int(id) for id in form.getlist("tag_ids")]
    }
    updated_persona = crud.update_persona(db, persona_id, schemas.PersonaUpdate(**persona_data))
    if updated_persona:
        return RedirectResponse(url=f"/admin/personas/{persona_id}", status_code=302)
    raise HTTPException(status_code=404, detail="Persona not found")

@admin_router.get("/prompt_templates/{prompt_template_id}", response_class=HTMLResponse)
async def view_prompt_template(request: Request, prompt_template_id: int, db: Session = Depends(get_db)):
    prompt_template = crud.get_prompt_template(db, prompt_template_id)
    if not prompt_template:
        raise HTTPException(status_code=404, detail="Prompt Template not found")
    return templates.TemplateResponse("admin/prompt_template_detail.html", {
        "request": request,
        "prompt_template": prompt_template
    })

@admin_router.get("/prompt_templates/{prompt_template_id}/edit", response_class=HTMLResponse)
async def edit_prompt_template(request: Request, prompt_template_id: int, db: Session = Depends(get_db)):
    prompt_template = crud.get_prompt_template(db, prompt_template_id)
    if not prompt_template:
        raise HTTPException(status_code=404, detail="Prompt Template not found")
    categories = crud.get_categories(db)
    tags = crud.get_tags(db)
    personas = crud.get_personas(db)
    return templates.TemplateResponse("admin/prompt_template_edit.html", {
        "request": request,
        "prompt_template": prompt_template,
        "categories": categories,
        "tags": tags,
        "personas": personas
    })

@admin_router.post("/prompt_templates/{prompt_template_id}/edit", response_class=HTMLResponse)
async def update_prompt_template(request: Request, prompt_template_id: int, db: Session = Depends(get_db)):
    form = await request.form()
    prompt_template_data = {
        "title": form.get("title"),
        "prompt": form.get("prompt"),
        "is_complex": form.get("is_complex") == "on",
        "default_persona_id": int(form.get("default_persona_id")),
        "category_ids": [int(id) for id in form.getlist("category_ids")],
        "tag_ids": [int(id) for id in form.getlist("tag_ids")]
    }
    updated_prompt_template = crud.update_prompt_template(db, prompt_template_id, schemas.PromptTemplateCreate(**prompt_template_data))
    if updated_prompt_template:
        return RedirectResponse(url=f"/admin/prompt_templates/{prompt_template_id}", status_code=302)
    raise HTTPException(status_code=404, detail="Prompt Template not found")

@admin_router.get("/prompt_templates/{prompt_template_id}/delete", response_class=HTMLResponse)
async def delete_prompt_template(request: Request, prompt_template_id: int, db: Session = Depends(get_db)):
    deleted_prompt_template = crud.delete_prompt_template(db, prompt_template_id)
    if deleted_prompt_template:
        return RedirectResponse(url="/admin/", status_code=302)
    raise HTTPException(status_code=404, detail="Prompt Template not found")

@admin_router.get("/tools/{tool_id}", response_class=HTMLResponse)
async def view_tool(request: Request, tool_id: int, db: Session = Depends(get_db)):
    tool = crud.get_tool(db, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    
    print(f"Tool: {tool.name}")
    print(f"Associated Personas: {[persona.role for persona in tool.personas]}")
    
    return templates.TemplateResponse("admin/tool_detail.html", {
        "request": request,
        "tool": tool
    })

@admin_router.get("/tools/{tool_id}/edit", response_class=HTMLResponse)
async def edit_tool(request: Request, tool_id: int, db: Session = Depends(get_db)):
    tool = crud.get_tool(db, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    personas = crud.get_personas(db)
    return templates.TemplateResponse("admin/tool_edit.html", {
        "request": request,
        "tool": tool,
        "personas": personas
    })

@admin_router.post("/tools/{tool_id}/edit", response_class=HTMLResponse)
async def update_tool(request: Request, tool_id: int, db: Session = Depends(get_db)):
    form = await request.form()
    tool_data = {
        "name": form.get("name"),
        "persona_ids": [int(id) for id in form.getlist("persona_ids")]
    }
    updated_tool = crud.update_tool(db, tool_id, schemas.ToolCreate(**tool_data))
    if updated_tool:
        return RedirectResponse(url=f"/admin/tools/{tool_id}", status_code=302)
    raise HTTPException(status_code=404, detail="Tool not found")

@admin_router.get("/tools/create", response_class=HTMLResponse)
async def create_tool_form(request: Request, db: Session = Depends(get_db)):
    personas = crud.get_personas(db)
    return templates.TemplateResponse("admin/tool_create.html", {
        "request": request,
        "personas": personas
    })

@admin_router.post("/tools/create", response_class=HTMLResponse)
async def create_tool(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    tool_data = {
        "name": form.get("name"),
        "persona_ids": [int(id) for id in form.getlist("persona_ids")]
    }
    new_tool = crud.create_tool(db, schemas.ToolCreate(**tool_data))
    return RedirectResponse(url=f"/admin/tools/{new_tool.id}", status_code=302)

@admin_router.get("/tools/{tool_id}/delete", response_class=HTMLResponse)
async def delete_tool(request: Request, tool_id: int, db: Session = Depends(get_db)):
    deleted_tool = crud.delete_tool(db, tool_id)
    if deleted_tool:
        return RedirectResponse(url="/admin/", status_code=302)
    raise HTTPException(status_code=404, detail="Tool not found")

@admin_router.get("/categories/{category_id}", response_class=HTMLResponse)
async def view_category(request: Request, category_id: int, db: Session = Depends(get_db)):
    category = crud.get_category(db, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return templates.TemplateResponse("admin/category_detail.html", {
        "request": request,
        "category": category
    })

@admin_router.get("/categories/{category_id}/edit", response_class=HTMLResponse)
async def edit_category(request: Request, category_id: int, db: Session = Depends(get_db)):
    category = crud.get_category(db, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return templates.TemplateResponse("admin/category_edit.html", {
        "request": request,
        "category": category
    })

@admin_router.post("/categories/{category_id}/edit", response_class=HTMLResponse)
async def update_category(request: Request, category_id: int, db: Session = Depends(get_db)):
    form = await request.form()
    category_data = {
        "name": form.get("name")
    }
    updated_category = crud.update_category(db, category_id, schemas.CategoryCreate(**category_data))
    if updated_category:
        return RedirectResponse(url=f"/admin/categories/{category_id}", status_code=302)
    raise HTTPException(status_code=404, detail="Category not found")

@admin_router.get("/categories/create", response_class=HTMLResponse)
async def create_category_form(request: Request, db: Session = Depends(get_db)):
    return templates.TemplateResponse("admin/category_create.html", {
        "request": request
    })

@admin_router.post("/categories/create", response_class=HTMLResponse)
async def create_category(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    category_data = {
        "name": form.get("name")
    }
    new_category = crud.create_category(db, schemas.CategoryCreate(**category_data))
    return RedirectResponse(url=f"/admin/categories/{new_category.id}", status_code=302)

@admin_router.get("/categories/{category_id}/delete", response_class=HTMLResponse)
async def delete_category(request: Request, category_id: int, db: Session = Depends(get_db)):
    deleted_category = crud.delete_category(db, category_id)
    if deleted_category:
        return RedirectResponse(url="/admin/", status_code=302)
    raise HTTPException(status_code=404, detail="Category not found")

@admin_router.get("/tags/{tag_id}", response_class=HTMLResponse)
async def view_tag(request: Request, tag_id: int, db: Session = Depends(get_db)):
    tag = crud.get_tag(db, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    return templates.TemplateResponse("admin/tag_detail.html", {
        "request": request,
        "tag": tag
    })

@admin_router.get("/tags/{tag_id}/edit", response_class=HTMLResponse)
async def edit_tag(request: Request, tag_id: int, db: Session = Depends(get_db)):
    tag = crud.get_tag(db, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    return templates.TemplateResponse("admin/tag_edit.html", {
        "request": request,
        "tag": tag
    })

@admin_router.post("/tags/{tag_id}/edit", response_class=HTMLResponse)
async def update_tag(request: Request, tag_id: int, db: Session = Depends(get_db)):
    form = await request.form()
    tag_data = {
        "name": form.get("name")
    }
    updated_tag = crud.update_tag(db, tag_id, schemas.TagCreate(**tag_data))
    if updated_tag:
        return RedirectResponse(url=f"/admin/tags/{tag_id}", status_code=302)
    raise HTTPException(status_code=404, detail="Tag not found")

@admin_router.get("/tags/create", response_class=HTMLResponse)
async def create_tag_form(request: Request, db: Session = Depends(get_db)):
    return templates.TemplateResponse("admin/tag_create.html", {
        "request": request
    })

@admin_router.post("/tags/create", response_class=HTMLResponse)
async def create_tag(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    tag_data = {
        "name": form.get("name")
    }
    new_tag = crud.create_tag(db, schemas.TagCreate(**tag_data))
    return RedirectResponse(url=f"/admin/tags/{new_tag.id}", status_code=302)

@admin_router.get("/tags/{tag_id}/delete", response_class=HTMLResponse)
async def delete_tag(request: Request, tag_id: int, db: Session = Depends(get_db)):
    deleted_tag = crud.delete_tag(db, tag_id)
    if deleted_tag:
        return RedirectResponse(url="/admin/", status_code=302)
    raise HTTPException(status_code=404, detail="Tag not found")

@admin_router.get("/chat_models/create", response_class=HTMLResponse)
async def create_chat_model_form(request: Request):
    logging.info("Accessing chat model creation form")
    return templates.TemplateResponse("admin/chat_model_create.html", {
        "request": request
    })

@admin_router.post("/chat_models/create", response_class=HTMLResponse)
async def create_chat_model(request: Request, db: Session = Depends(get_db)):
    try:
        form = await request.form()
        chat_model_data = {
            "name": form.get("name"),
            "description": form.get("description"),
            "api_key": form.get("api_key"),
            "model": form.get("model"),
            "provider": form.get("provider"),
            "default": form.get("default") == "on"
        }
        
        # Check if required fields are present
        if not chat_model_data["name"] or not chat_model_data["model"] or not chat_model_data["provider"]:
            raise ValueError("Name, Model, and Provider are required fields")
        
        logging.info(f"Attempting to create chat model with data: {chat_model_data}")
        new_chat_model = crud.create_chat_model(db, schemas.ChatModelCreate(**chat_model_data))
        logging.info(f"Successfully created chat model with ID: {new_chat_model.id}")
        return RedirectResponse(url=f"/admin/chat_models/{new_chat_model.id}", status_code=302)
    except ValueError as ve:
        logging.error(f"Validation error: {str(ve)}")
        return templates.TemplateResponse("admin/chat_model_create.html", {
            "request": request,
            "error": str(ve)
        })
    except Exception as e:
        logging.error(f"Error creating chat model: {str(e)}")
        return templates.TemplateResponse("admin/chat_model_create.html", {
            "request": request,
            "error": f"An error occurred: {str(e)}"
        })

@admin_router.get("/chat_models", response_class=HTMLResponse)
async def list_chat_models(request: Request, db: Session = Depends(get_db)):
    chat_models = crud.get_chat_models(db)
    return templates.TemplateResponse("admin/chat_model_list.html", {
        "request": request,
        "chat_models": chat_models
    })

@admin_router.get("/chat_models/{chat_model_id}", response_class=HTMLResponse)
async def view_chat_model(request: Request, chat_model_id: int, db: Session = Depends(get_db)):
    chat_model = crud.get_chat_model(db, chat_model_id)
    if not chat_model:
        raise HTTPException(status_code=404, detail="Chat Model not found")
    return templates.TemplateResponse("admin/chat_model_detail.html", {
        "request": request,
        "chat_model": chat_model
    })

@admin_router.get("/chat_models/{chat_model_id}/edit", response_class=HTMLResponse)
async def edit_chat_model(request: Request, chat_model_id: int, db: Session = Depends(get_db)):
    chat_model = crud.get_chat_model(db, chat_model_id)
    if not chat_model:
        raise HTTPException(status_code=404, detail="Chat Model not found")
    return templates.TemplateResponse("admin/chat_model_edit.html", {
        "request": request,
        "chat_model": chat_model
    })

@admin_router.post("/chat_models/{chat_model_id}/edit", response_class=HTMLResponse)
async def update_chat_model(request: Request, chat_model_id: int, db: Session = Depends(get_db)):
    form = await request.form()
    chat_model_data = {
        "name": form.get("name"),
        "description": form.get("description"),
        "api_key": form.get("api_key"),
        "model": form.get("model"),
        "provider": form.get("provider"),
        "default": form.get("default") == "on"
    }
    updated_chat_model = crud.update_chat_model(db, chat_model_id, schemas.ChatModelCreate(**chat_model_data))
    if updated_chat_model:
        return RedirectResponse(url=f"/admin/chat_models/{chat_model_id}", status_code=302)
    raise HTTPException(status_code=404, detail="Chat Model not found")

@admin_router.get("/chat_models/{chat_model_id}/delete", response_class=HTMLResponse)
async def delete_chat_model(request: Request, chat_model_id: int, db: Session = Depends(get_db)):
    deleted_chat_model = crud.delete_chat_model(db, chat_model_id)
    if deleted_chat_model:
        return RedirectResponse(url="/admin/chat_models", status_code=302)
    raise HTTPException(status_code=404, detail="Chat Model not found")

@admin_router.get("/chat", response_class=HTMLResponse)
async def admin_chat(request: Request, db: Session = Depends(get_db)):
    chat_models = crud.get_chat_models(db)
    personas = crud.get_personas(db)
    return templates.TemplateResponse("admin/chat.html", {
        "request": request,
        "chat_models": chat_models,
        "personas": personas
    })

@admin_router.get("/personas/create", response_class=HTMLResponse)
async def create_persona_form(request: Request):
    return templates.TemplateResponse("create_persona.html", {"request": request})

@admin_router.post("/personas/create", response_class=HTMLResponse)
async def create_persona(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    # Extract form data
    name = form.get("name")
    description = form.get("description")
    prompt = form.get("prompt")
    
    # Create new persona
    new_persona = Persona(name=name, description=description, prompt=prompt)
    db.add(new_persona)
    db.commit()
    
    return RedirectResponse(url="/admin/personas", status_code=303)