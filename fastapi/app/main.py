from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.security import HTTPBearer
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from app.api.v1.router import public_router, protected_router
from app.api.v1.workflows import router as workflow_router, public_router as workflow_public_router
from app.api.v1.dependencies import get_current_user
from app.api.v1 import (
    authentication,
    categories,
    chat_models,
    chat,
    personas,
    prompt_templates,
    tags,
    tools,
    workflows,
    assets,
    knowledge_bases,
    batch_flow,
    rag,
    users
)
from app.database import engine, Base
from dotenv import load_dotenv
import logging
import os
from pydantic import BaseModel

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                    handlers=[logging.StreamHandler()])

app = FastAPI(
    title="AmaruAI API",
    version="1.0.0",
    redirect_slashes=True
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logging.error(f"Validation error: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )

# Get environment
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Update origins list to include all possible variations
origins = [
    "http://localhost:3000",
    "https://localhost:3000",
    "http://localhost:8000",
    "https://localhost:8000",
    "http://amaruai.vercel.app",
    "https://amaruai.vercel.app",
    "https://amaruai.com",
    "https://www.amaruai.com",
    "https://accurate-courtesy-production.up.railway.app"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
    expose_headers=["*"],
    max_age=3600
)

# Mount the public routes (authentication only)
app.include_router(
    authentication.router,
    prefix="/api/v1",
    tags=["auth"]
)

# Mount all protected routes
protected_routes = [
    categories.router,
    chat_models.router,
    chat.router,
    personas.router,
    prompt_templates.router,
    tags.router,
    tools.router,
    knowledge_bases.router,
    assets.router,
    batch_flow.router,
    workflows.router,  # Protected workflow routes
    rag.router,  # RAG routes
    users.router  # User routes
]

for router in protected_routes:
    app.include_router(
        router,
        prefix="/api/v1",
        dependencies=[Depends(get_current_user)]
    )

# Mount workflow routes
app.include_router(workflow_router, prefix="/api/v1")
app.include_router(workflow_public_router, prefix="/api/v1")

# Create database tables
Base.metadata.create_all(bind=engine)

# Custom OpenAPI schema
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        routes=app.routes,
    )

    # Add security scheme to components
    if "components" not in openapi_schema:
        openapi_schema["components"] = {}
    if "securitySchemes" not in openapi_schema["components"]:
        openapi_schema["components"]["securitySchemes"] = {}

    openapi_schema["components"]["securitySchemes"]["Bearer"] = {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "Enter your API key or JWT token as: **Bearer your-token**"
    }

    # Add security requirement to all routes except auth
    openapi_schema["security"] = [{"Bearer": []}]

    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

@app.get("/")
async def root():
    return {"message": "Welcome to AmaruAI API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
