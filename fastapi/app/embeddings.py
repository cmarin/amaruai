# embeddings.py
import logging
import os
import psycopg2
from datetime import datetime
import vecs
from vecs.collection import CollectionNotFound

# LlamaIndex imports
from llama_index.core.node_parser import SemanticSplitterNodeParser
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.core import Document

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
    Creates embeddings for an asset using a semantic chunking approach:
      1) Use LlamaIndex to split the document into semantically cohesive chunks.
      2) Generate embeddings (OpenAI) for each chunk.
      3) Upsert them into vecs.<collection_name> with chunk-level metadata.
    """
    try:
        # A) Check for an OpenAI key
        openai_key = os.getenv("OPENAI_API_KEY")
        if not openai_key:
            logger.error("No OPENAI_API_KEY found in environment.")
            return False

        # B) Connect to vecs
        c = vecs.create_client(postgres_connection_string)

        # C) Get or create the collection
        try:
            coll = c.get_or_create_collection(name=collection_name, dimension=dimension)
        except CollectionNotFound:
            logger.error(f"Collection {collection_name} could not be found or created.")
            c.disconnect()
            return False

        # D) Chunk the document using LlamaIndex semantic splitter
        #    We'll need an embedding model handle for LlamaIndex to decide chunk breakpoints
        embed_model = OpenAIEmbedding(api_key=openai_key)
        splitter = SemanticSplitterNodeParser(
            buffer_size=1,
            breakpoint_percentile_threshold=95,  # tune as needed
            embed_model=embed_model
        )

        # Wrap the text content in a LlamaIndex "Document" object
        doc = Document(text=document_content)

        # This returns a list of "Node" objects, each containing chunked text
        chunk_nodes = splitter.get_nodes_from_documents([doc])

        # E) Generate embeddings for each chunk and upsert them
        from openai import OpenAI
        openai_client = OpenAI(api_key=openai_key)

        records_to_upsert = []

        for idx, node in enumerate(chunk_nodes):
            chunk_text = node.get_content()

            # 1) Generate embedding for this chunk
            resp = openai_client.embeddings.create(
                model="text-embedding-ada-002",
                input=chunk_text
            )
            chunk_embedding = resp.data[0].embedding

            # 2) Build a unique record_id for this chunk
            #    e.g.:  asset-UUID-chunk0, chunk1, etc.
            record_id = f"asset-{asset_id}-chunk-{idx}"

            # 3) Metadata includes entire chunk text, chunk index, etc.
            metadata = {
                "asset_id": asset_id,
                "document_name": document_name,
                "chunk_index": idx,
                "chunk_text": chunk_text[:5000],  # optionally truncate if too big
                "created_at": datetime.utcnow().isoformat()
            }

            records_to_upsert.append((record_id, chunk_embedding, metadata))

        # If there are no chunks, something went wrong or the doc is empty
        if not records_to_upsert:
            logger.warning(f"No chunks were created for asset {asset_id}.")
            c.disconnect()
            return False

        # F) Upsert all chunk records
        coll.upsert(records=records_to_upsert)

        # G) Clean up
        c.disconnect()

        logger.info(
            f"Embeddings (in {len(records_to_upsert)} chunks) "
            f"successfully created for asset {asset_id}"
        )
        return True

    except Exception as e:
        logger.error(f"Error creating embeddings for asset {asset_id}: {str(e)}", exc_info=True)
        return False

def text_to_embedding(text: str) -> list[float]:
    """
    Convert input text to an embedding using OpenAI's embedding model.
    
    Args:
        text (str): The input text to convert to an embedding
        
    Returns:
        list[float]: The embedding vector
        
    Raises:
        ValueError: If OpenAI API key is not set or if the API call fails
    """
    openai_key = os.getenv("OPENAI_API_KEY")
    if not openai_key:
        raise ValueError("No OPENAI_API_KEY found in environment.")
        
    from openai import OpenAI
    openai_client = OpenAI(api_key=openai_key)
    
    resp = openai_client.embeddings.create(
        model="text-embedding-ada-002",
        input=text
    )
    return resp.data[0].embedding

def find_relevant_chunks(
    embedding: list[float],
    postgres_connection_string: str,
    collection_name: str = "embeddings",
    num_chunks: int = 5,
    similarity_cutoff: float = 0.7
) -> list[dict]:
    """
    Find the most relevant chunks based on a query embedding.
    
    Args:
        embedding (list[float]): The query embedding vector
        postgres_connection_string (str): Connection string for the Postgres database
        collection_name (str): Name of the vecs collection to search in
        num_chunks (int): Number of chunks to return
        similarity_cutoff (float): Minimum similarity score threshold
        
    Returns:
        list[dict]: List of relevant chunks with their metadata and similarity scores
    """
    # Connect to vecs
    c = vecs.create_client(postgres_connection_string)
    
    try:
        # Get the collection
        coll = c.get_collection(name=collection_name)
        
        # Query for similar vectors
        results = coll.query(
            data=embedding,
            limit=num_chunks,
            include_value=True,
            include_metadata=True
        )
        
        # Filter and format results
        relevant_chunks = []
        for record_id, score, value, metadata in results:
            if score >= similarity_cutoff:
                relevant_chunks.append({
                    "id": record_id,
                    "score": score,
                    "metadata": metadata
                })
                
        return relevant_chunks
        
    finally:
        c.disconnect()
