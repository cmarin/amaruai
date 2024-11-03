from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.security import HTTPBearer
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
from app.api.v1.dependencies import get_current_user
from dotenv import load_dotenv
import logging
from app.api.v1.workflows import router as workflow_router, public_router as workflow_public_router

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

# Security scheme
security_scheme = HTTPBearer(
    scheme_name="Authorization",
    description="Enter your API key as: **Bearer your-api-key**"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    allow_origin_regex=None,
    max_age=600,
)

# Mount the public routes (authentication)
app.include_router(
    authentication.router,
    prefix="/api/v1",
    tags=["auth"]
)

# Mount all protected routes with authentication
protected_routes = [
    categories,
    chat_models,
    chat,
    personas,
    prompt_templates,
    tags,
    tools,
    workflows
]

for module in protected_routes:
    app.include_router(
        module.router,
        prefix="/api/v1",
        dependencies=[Depends(get_current_user)]  # Add authentication to all protected routes
    )

# Include admin routes
app.include_router(
    admin_router, 
    prefix="/admin", 
    tags=["admin"],
    dependencies=[Depends(get_current_user)]  # Protect admin routes
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)