from fastapi import APIRouter, Depends
from app.api.v1.dependencies import get_current_user

# Create two routers - one for public routes and one for protected routes
public_router = APIRouter()
protected_router = APIRouter(dependencies=[Depends(get_current_user)])


# Function to create a namespaced protected router
def create_protected_router(prefix: str = "", tags: list = None) -> APIRouter:
    """
    Creates a protected router with a specific prefix and tags.
    This router will inherit the authentication dependency.
    """
    if tags is None:
        tags = [prefix] if prefix else []
        
    return APIRouter(
        prefix=f"/{prefix}" if prefix else "",
        tags=tags,
        dependencies=[Depends(get_current_user)]
    )

