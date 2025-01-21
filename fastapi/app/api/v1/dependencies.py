from fastapi import Depends, HTTPException, Header
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

async def get_current_user(authorization: Optional[str] = Header(None)) -> str:
    """
    Get the current authenticated user from the JWT token.
    
    Args:
        authorization (str): The Authorization header containing the JWT token
        
    Returns:
        str: The user's email
        
    Raises:
        HTTPException: If the token is invalid or missing
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
        
    try:
        # Remove 'Bearer ' prefix if present
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