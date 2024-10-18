from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import personas, tools, prompt_templates, categories, tags, chat_models, chat, workflows
from app.database import engine, Base
from app.admin import admin_router

app = FastAPI(title="ChatMatrix API", version="0.1.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(personas.router, prefix="/api/v1", tags=["personas"])
app.include_router(tools.router, prefix="/api/v1", tags=["tools"])
app.include_router(prompt_templates.router, prefix="/api/v1", tags=["prompt_templates"])
app.include_router(categories.router, prefix="/api/v1", tags=["categories"])
app.include_router(tags.router, prefix="/api/v1", tags=["tags"])
app.include_router(chat_models.router, prefix="/api/v1", tags=["chat_models"])
app.include_router(admin_router, prefix="/admin", tags=["admin"])
app.include_router(chat.router, prefix="/api/v1", tags=["chat"])
app.include_router(workflows.router, prefix="/api/v1", tags=["workflows"])

# Create database tables
Base.metadata.create_all(bind=engine)

@app.get("/")
async def root():
    return {"message": "Welcome to ChatMatrix API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
