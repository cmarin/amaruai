# file: app/embeddings.py

import logging
from datetime import datetime

from llama_index import Document
from llama_index.node_parser import SimpleNodeParser  # or SemanticSplitterNodeParser
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.vector_stores.supabase import SupabaseVectorStore
from llama_index import StorageContext, VectorStoreIndex

logger = logging.getLogger(__name__)

def create_embeddings_for_asset(
    asset_id: str,
    document_content: str,
    document_name: str,
    postgres_connection_string: str
) -> bool:
    """
    Creates embeddings for the given text and stores them in Supabase.

    :param asset_id: UUID string of the asset
    :param document_content: The extracted text content
    :param document_name: The file name or user-friendly doc name
    :param postgres_connection_string: Connection string to your Postgres DB (Supabase)
    :return: True if successful, False otherwise
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

        # 2) (Optionally) Split the document into chunks.
        #    You can use SimpleNodeParser or a more advanced splitter.
        parser = SimpleNodeParser()
        nodes = parser.get_nodes_from_documents([document])

        # 3) Initialize the embedding model
        embed_model = OpenAIEmbedding()  # uses OPENAI_API_KEY

        # 4) Initialize the Supabase vector store
        vector_store = SupabaseVectorStore(
            postgres_connection_string=postgres_connection_string,
            table_name="embeddings",
            # dimension=1536,  # You can specify dimension if needed
            embed_model=embed_model
        )

        # 5) Create a storage context and index
        storage_context = StorageContext.from_defaults(vector_store=vector_store)
        index = VectorStoreIndex(nodes, storage_context=storage_context)

        # 6) That’s it! The index creation automatically upserts embeddings into the DB.
        #    If you need to verify or query them, you can do so via the index’s query engine.

        logger.info(f"Embeddings successfully created for asset {asset_id}")
        return True

    except Exception as e:
        logger.error(f"Error creating embeddings for asset {asset_id}: {str(e)}", exc_info=True)
        return False
