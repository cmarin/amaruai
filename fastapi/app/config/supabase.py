# config/supabase.py
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_ANON_KEY")  # Changed from SUPABASE_SERVICE_KEY to SUPABASE_ANON_KEY

if not supabase_url or not supabase_key:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in environment variables")

# Create the Supabase client
supabase_client: Client = create_client(supabase_url, supabase_key)

# Export both sync and async clients
__all__ = ['supabase_client', 'supabase_url', 'supabase_key']
