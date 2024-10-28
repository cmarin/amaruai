from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import public_router, protected_router
from app.api.v1 import (
    authentication,
    categories,
    chat_models,
    chat,
    personas,
    prompt_templates,
    tags,
    tools,
    workflows
)
from app.database import engine, Base
from app.admin import admin_router
from dotenv import load_dotenv
import logging

load_dotenv()  # Add this line to load environment variables

# Configure logging
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                    handlers=[logging.StreamHandler()])

app = FastAPI(
    title="AmaruAI API",
    version="1.0.0",
    redirect_slashes=True
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],  # Add this line
    allow_origin_regex=None,
    max_age=600,
)

# Mount the public routes (authentication)
app.include_router(
    authentication.router,
    prefix="/api/v1",
    tags=["auth"]
)

# Mount all protected routes
for module in [
    categories,
    chat_models,
    chat,
    personas,
    prompt_templates,
    tags,
    tools,
    workflows
]:
    app.include_router(
        module.router,
        prefix="/api/v1"
    )

# Include API routers
app.include_router(admin_router, prefix="/admin", tags=["admin"])

# Create database tables
Base.metadata.create_all(bind=engine)

@app.get("/")
async def root():
    return {"message": "Welcome to ChatMatrix API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
