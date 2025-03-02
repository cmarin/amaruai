from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app import models
from app.database import get_db
from app.api.v1.router import create_protected_router
from app.api.v1.dependencies import get_current_user_id, get_current_user
from app.schemas import UserInfo

# Create a router for user endpoints
router = create_protected_router(prefix="users", tags=["users"])

@router.get("/me", response_model=UserInfo)
async def get_current_user_info(
    db: Session = Depends(get_db),
    current_user_id: UUID = Depends(get_current_user_id)
):
    """
    Get the current user's information.
    """
    user = db.query(models.User).filter(models.User.id == current_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user

@router.get("/{user_id}", response_model=UserInfo)
async def get_user_info(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user_id: UUID = Depends(get_current_user_id)
):
    """
    Get user information by ID.
    Returns organization, role, and active state.
    """
    # Check if the user exists
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user 