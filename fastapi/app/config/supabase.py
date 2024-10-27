# config/supabase.py
from dotenv import load_dotenv
import os
from supabase import create_client

load_dotenv()

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_ANON_KEY")  # Changed from SUPABASE_SERVICE_KEY to SUPABASE_ANON_KEY

if not supabase_url or not supabase_key:
    raise ValueError("Missing Supabase environment variables")

supabase = create_client(supabase_url, supabase_key)
