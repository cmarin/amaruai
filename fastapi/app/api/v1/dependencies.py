from fastapi import Depends, HTTPException, Header
from typing import Optional
import logging
from app.config.supabase import supabase
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


async def get_current_user(authorization: Optional[str] = Header(None)):
    logger.debug(f"Received authorization header: {authorization}")
    if not authorization:
        logger.error("No authorization header provided")
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        # Remove 'Bearer ' prefix
        token = authorization.split(' ')[1]
        logger.debug(f"Extracted token: {token[:20]}...")
        # First try to verify the token directly
        try:
            user = supabase.auth.get_user(token)
            logger.debug(f"Successfully got user directly: {user.user.email}")
            return user.user
        except Exception as direct_error:
            logger.warning(f"Direct token verification failed: {str(direct_error)}")
            # If direct verification fails, try setting the session
            try:
                supabase.auth.set_session({
                    "access_token": token,
                    "refresh_token": ""  # We don't have the refresh token from the header
                })
                # Now try to get the session
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
