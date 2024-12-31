# config/supabase.py
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables")

# Create the Supabase client
supabase: Client = create_client(supabase_url, supabase_key)

# Also create a client with the original name for the assets module
supabase_client = create_client(
    supabase_url,
    supabase_key,
    { 'db': { 'schema': 'pgmq_public' } }
)

# Export all needed variables
__all__ = ['supabase', 'supabase_client', 'supabase_url', 'supabase_key']
