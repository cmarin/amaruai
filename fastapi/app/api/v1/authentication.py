from fastapi import APIRouter, HTTPException
from config.supabase import supabase
import logging

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG)

router = APIRouter()

@router.post("/auth/login")
async def login(email: str, password: str):
    try:
        logger.debug(f"Attempting login for email: {email}")
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        logger.debug(f"Login successful. Session token: {response.session.access_token[:20]}...")
        logger.debug(f"Full response session data: {response.session}")
        return response
    except Exception as e:
        logger.error(f"Login failed: {str(e)}")
        raise HTTPException(status_code=401, detail=str(e))

@router.post("/auth/logout")
async def logout():
    try:
        logger.debug("Attempting logout")
        response = supabase.auth.sign_out()
        logger.debug("Logout successful")
        return response
    except Exception as e:
        logger.error(f"Logout failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/auth/user")
async def get_user():
    try:
        logger.debug("Attempting to get user")
        session = supabase.auth.get_session()
        if session:
            logger.debug(f"Current session token: {session.access_token[:20]}...")
            user = supabase.auth.get_user(session.access_token)
            logger.debug(f"User retrieved: {user.user.email}")
            return user
        else:
            logger.warning("No active session found")
            raise HTTPException(status_code=401, detail="No active session")
    except Exception as e:
        logger.error(f"Get user failed: {str(e)}")
        raise HTTPException(status_code=401, detail=str(e))
