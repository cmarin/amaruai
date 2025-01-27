from fastapi import Depends, HTTPException, Security, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app import crud, models
from uuid import UUID
from typing import Optional
import logging
import os
from app.config.supabase import supabase
from dotenv import load_dotenv
import jwt
from app.config.supabase import supabase_client
load_dotenv()
print(f"Loaded API key: {os.getenv('SERVICE1_API_KEY')}")

logger = logging.getLogger(__name__)

security = HTTPBearer()

async def get_current_user_old(authorization: Optional[str] = Header(None)) -> str:
    """Legacy authentication that expects email in header."""
    if authorization is None:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    return authorization

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
    db: Session = Depends(get_db)
) -> UUID:
    """
    Get current user from token and return their UUID.
    The token/credentials.credentials in this case is the user's email.
    """
    try:
        email = credentials.credentials
        # Get user by email
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user.id  # Return the UUID
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Could not validate credentials: {str(e)}"
        )

async def get_current_user_old(authorization: Optional[str] = Header(None)) -> str:
    """
    Get the current authenticated user from the JWT token.
    
    Args:
        authorization (str): The Authorization header containing the JWT token or API key
        
    Returns:
        str: The user's email
        
    Raises:
        HTTPException: If the token/key is invalid or missing
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    # Check for API key first
    api_key = os.getenv("SERVICE1_API_KEY")
    if api_key and authorization.strip() == f"Bearer {api_key}":
        return "api@service.internal"  # Return a service account identifier
        
    try:
        # If not API key, try JWT token
        if authorization.startswith('Bearer '):
            token = authorization[7:]
        else:
            token = authorization
            
        # Decode the JWT token
        decoded = jwt.decode(token, options={"verify_signature": False})
        email = decoded.get('email')
        
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token: no email claim")
            
        return email
        
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication error: {str(e)}")