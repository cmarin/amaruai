# dependencies.py
from fastapi import Depends, HTTPException, Header
from typing import Optional
import logging
import os
from app.config.supabase import supabase
from dotenv import load_dotenv
load_dotenv()
print(f"Loaded API key: {os.getenv('SERVICE1_API_KEY')}")

logger = logging.getLogger(__name__)

async def get_current_user(authorization: Optional[str] = Header(None)):
    logger.info(f"[DEBUG] Raw authorization header received: {authorization}")
    
    # Check if authorization header exists
    if not authorization:
        logger.error("No authorization header provided")
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check for API key first
    api_key = os.getenv("SERVICE1_API_KEY")
    if api_key and authorization.strip() == f"Bearer {api_key}":  # Added strip() to remove any whitespace
        logger.debug("API key authentication successful")
        return {
            "email": "api@service.internal",
            "is_api_user": True
        }
    
    try:
        token = authorization.split(' ')[1]
        try:
            user = supabase.auth.get_user(token)
            logger.debug(f"Successfully got user directly: {user.user.email}")
            return user.user
        except Exception as direct_error:
            logger.warning(f"Direct token verification failed: {str(direct_error)}")
            try:
                supabase.auth.set_session({
                    "access_token": token,
                    "refresh_token": ""
                })
                session = supabase.auth.get_session()
                if session:
                    logger.debug(f"Successfully got session after setting it manually")
                    return session.user
                else:
                    raise ValueError("No session after setting token")
            except Exception as session_error:
                logger.error(f"Session-based verification failed: {str(session_error)}")
                raise
    except Exception as e:
        logger.error(f"Error in get_current_user: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")