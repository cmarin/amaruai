# file: app/embeddings.py

import logging
from datetime import datetime
from typing import Optional

from llama_index.core import Document, VectorStoreIndex, Settings
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.vector_stores.supabase import SupabaseVectorStore

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------------------
# OPTION A (Global Embedding Model):
#
#     # Set the default embedding model *once* for everything:
#     Settings.embed_model = OpenAIEmbedding()
#
# But we show Option B (Per-Index Embedding) in the function below.
# ------------------------------------------------------------------------------


def create_embeddings_for_asset(
    asset_id: str,
    document_content: str,
    document_name: str,
    postgres_connection_string: str,
    table_name: str = "embeddings",
    use_global_embed_model: bool = False
) -> bool:
    """
    Creates embeddings for an asset's text content and stores them in Supabase.

    Args:
        asset_id (str): UUID (as string) of the asset
        document_content (str): Extracted text content
        document_name (str): Friendly doc name (e.g. filename)
        postgres_connection_string (str): Connection string to Supabase Postgres
        table_name (str): Defaults to "embeddings"
        use_global_embed_model (bool): If True, use global Settings.embed_model
                                       If False, provide embed_model per-index
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # 1) Create a Document with metadata
        document = Document(
            text=document_content,
            metadata={
                "asset_id": asset_id,
                "document_name": document_name,
                "created_at": datetime.utcnow().isoformat()
            }
        )
        # You can also set advanced doc properties here (excluded_llm_metadata_keys, etc.)

        # 2) Build a list of documents
        documents = [document]

        # 3) Initialize the Supabase vector store
        vector_store = SupabaseVectorStore(
            postgres_connection_string=postgres_connection_string,
            table_name=table_name
        )

        # 4) (Optional) Decide how to set your embedding model:
        if use_global_embed_model:
            # Option A: Global embedding model for the entire app
            Settings.embed_model = OpenAIEmbedding()
            # Then do not pass `embed_model=` to from_documents (it uses the global)
            index = VectorStoreIndex.from_documents(
                documents=documents,
                vector_store=vector_store
            )
        else:
            # Option B: Provide the embedding model per-index
            embed_model = OpenAIEmbedding()
            index = VectorStoreIndex.from_documents(
                documents=documents,
                embed_model=embed_model,
                vector_store=vector_store
            )

        # The moment we create the index, embeddings are upserted to Supabase
        logger.info(f"Embeddings successfully created for asset {asset_id}")
        return True

    except Exception as e:
        logger.error(f"Error creating embeddings for asset {asset_id}: {str(e)}", exc_info=True)
        return False
