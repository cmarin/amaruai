# file: app/embeddings.py

import logging
import os
import psycopg2
import vecs
from datetime import datetime
from openai import OpenAI
from vecs.collection import CollectionNotFound

logger = logging.getLogger(__name__)


def create_embeddings_for_asset(
    asset_id: str,
    document_content: str,
    document_name: str,
    postgres_connection_string: str,
    collection_name: str = "embeddings",
    dimension: int = 1536
) -> bool:
    """
    Creates embeddings for an asset using the "manual" approach:
      1) Creates an embedding with openai.OpenAI
      2) Upserts it (id, embedding, metadata) into vecs.<collection_name>
      3) Returns True if successful, False if there's an error.

    Args:
        asset_id (str): the UUID of the asset
        document_content (str): the text to embed
        document_name (str): filename or a descriptive doc name
        postgres_connection_string (str): Postgres DB URL for Supabase
        collection_name (str): name of the vecs collection (default: "embeddings")
        dimension (int): embedding dimension (default: 1536 for text-embedding-ada-002)
    """
    try:
        # A) Check for an OpenAI key
        openai_key = os.getenv("OPENAI_API_KEY")
        if not openai_key:
            logger.error("No OPENAI_API_KEY found in environment.")
            return False

        # B) Create OpenAI client
        client = OpenAI(api_key=openai_key)

        # C) Generate embedding
        resp = client.embeddings.create(
            model="text-embedding-ada-002",
            input=document_content
        )
        embedding = resp.data[0].embedding  # list of floats

        # D) Connect to vecs
        c = vecs.create_client(postgres_connection_string)

        # E) Get or create the collection
        try:
            coll = c.get_or_create_collection(name=collection_name, dimension=dimension)
        except CollectionNotFound:
            # Should rarely happen because get_or_create_collection auto-creates if needed
            logger.error(f"Collection {collection_name} could not be found or created.")
            c.disconnect()
            return False

        # F) Upsert record
        record_id = f"asset-{asset_id}-{os.urandom(4).hex()}"
        metadata = {
            "asset_id": asset_id,
            "document_name": document_name,
            "created_at": datetime.utcnow().isoformat()
        }
        coll.upsert(
            records=[
                (
                    record_id,
                    embedding,
                    metadata
                )
            ]
        )

        # G) Clean up
        c.disconnect()

        logger.info(f"Embeddings successfully created for asset {asset_id}, record_id={record_id}")
        return True

    except Exception as e:
        logger.error(f"Error creating embeddings for asset {asset_id}: {str(e)}", exc_info=True)
        return False
