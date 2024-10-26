from fastapi import APIRouter
from config.supabase import supabase

router = APIRouter()

@router.post("/auth/login")
async def login(email: str, password: str):
    try:
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        return response
    except Exception as e:
        return {"error": str(e)}

@router.post("/auth/logout")
async def logout():
    response = supabase.auth.sign_out()
    return response

@router.get("/auth/user")
async def get_user():
    user = supabase.auth.get_user()
    return user