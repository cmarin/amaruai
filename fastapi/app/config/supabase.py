# config/supabase.py
import os
from supabase import create_client, Client
from supabase.lib.client_options import ClientOptions
from dotenv import load_dotenv

load_dotenv()

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables")

# Create the Supabase client with proper ClientOptions
supabase: Client = create_client(
    supabase_url,
    supabase_key,
    options=ClientOptions(
        schema="pgmq_public",
        postgrest_client_timeout=10
    )
)

# Use the same instance for supabase_client
supabase_client = supabase

# Export all needed variables
__all__ = ['supabase', 'supabase_client', 'supabase_url', 'supabase_key']
