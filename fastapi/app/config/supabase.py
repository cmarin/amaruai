# config/supabase.py
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables")

# Create options dictionary with headers
options = {
    'headers': {
        'X-Client-Info': 'supabase-py/0.0.1',
    },
    'db': {
        'schema': 'pgmq_public'
    }
}

# Create the Supabase clients
supabase: Client = create_client(supabase_url, supabase_key, options)
supabase_client = supabase  # Use the same client instance

# Export all needed variables
__all__ = ['supabase', 'supabase_client', 'supabase_url', 'supabase_key']
