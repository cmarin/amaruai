import os
import uuid
import tempfile
import logging
from typing import List
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

logger = logging.getLogger(__name__)

# Reduced max file size to 24MB for OpenAI API compatibility
MAX_FILE_SIZE_BYTES = 24 * 1024 * 1024  # 24 MB in bytes

class WhisperService:
    """
    Utility for transcribing MP3/WAV files using Whisper, with support for:
    1. Local transcription using whisper library
    2. OpenAI's Whisper API service
    
    Configuration via environment variables:
    - WHISPER_API: If "true", use OpenAI's API instead of local transcription
    - WHISPER_MODEL: Model to use (e.g. "whisper-1" for API, or "base"/"small" for local)
    """

    def __init__(self, model_name: str = None):
        """
        Initialize the service based on environment configuration.
        :param model_name: Optional model name override. If not provided, uses WHISPER_MODEL env var.
        """
        self.use_api = os.getenv("WHISPER_API", "").lower() == "true"
        self.model_name = model_name or os.getenv("WHISPER_MODEL", "whisper-1")
        
        if self.use_api:
            logger.info(f"Using OpenAI Whisper API with model: {self.model_name}")
            self.client = OpenAI()
        else:
            logger.info(f"Using local Whisper model: {self.model_name}")
            import whisper
            self.model = whisper.load_model(self.model_name)

    def transcribe_audio(self, file_path: str) -> str:
        """
        Transcribe audio file, handling large files by splitting if necessary.
        :param file_path: Path to the input audio file (mp3/wav).
        :return: Full transcription text from all chunks.
        """
        file_size = os.path.getsize(file_path)
        if file_size <= MAX_FILE_SIZE_BYTES:
            # If file fits within limit, transcribe it directly
            return self._transcribe_single_chunk(file_path)
        else:
            # If file > limit, split into multiple chunks
            chunk_paths = self._split_audio_file(file_path)
            transcribed_texts = []
            try:
                for chunk_path in chunk_paths:
                    text = self._transcribe_single_chunk(chunk_path)
                    transcribed_texts.append(text)
            finally:
                # Clean up chunk files
                for chunk_path in chunk_paths:
                    if os.path.exists(chunk_path):
                        os.remove(chunk_path)

            return " ".join(transcribed_texts)

    def _transcribe_single_chunk(self, chunk_path: str) -> str:
        """
        Transcribe a single audio chunk using either local Whisper or OpenAI API.
        :param chunk_path: Path to the audio chunk
        :return: Transcribed text
        """
        logger.debug(f"Transcribing chunk {chunk_path}")
        
        try:
            if self.use_api:
                with open(chunk_path, 'rb') as audio_file:
                    transcription = self.client.audio.transcriptions.create(
                        model=self.model_name,
                        file=audio_file
                    )
                    return transcription.text
            else:
                result = self.model.transcribe(chunk_path)
                return result.get("text", "")
                
        except Exception as e:
            logger.error(f"Error transcribing chunk {chunk_path}: {str(e)}", exc_info=True)
            raise

    def _split_audio_file(self, file_path: str) -> List[str]:
        """
        Split a large audio file into multiple chunks (each <= 24MB).
        Returns a list of chunk file paths.
        """
        chunks = []
        file_size = os.path.getsize(file_path)
        # Calculate how many chunks we need
        num_chunks = (file_size // MAX_FILE_SIZE_BYTES) + 1
        bytes_per_chunk = file_size // num_chunks + 1

        logger.info(
            f"Splitting audio file '{file_path}' of size {file_size} bytes "
            f"into {num_chunks} chunk(s) (<=24MB each)."
        )

        # Create a unique temporary directory for this transcription job
        temp_dir = tempfile.mkdtemp(prefix="whisper_chunks_")
        try:
            with open(file_path, "rb") as source_file:
                for chunk_idx in range(num_chunks):
                    chunk_data = source_file.read(bytes_per_chunk)
                    if not chunk_data:
                        break

                    # Create chunk file in our unique temp directory
                    chunk_path = os.path.join(temp_dir, f"chunk_{chunk_idx}_{uuid.uuid4()}.wav")
                    with open(chunk_path, "wb") as chunk_file:
                        chunk_file.write(chunk_data)

                    chunks.append(chunk_path)

            return chunks
        except Exception as e:
            # Clean up temp directory on error
            for chunk_path in chunks:
                if os.path.exists(chunk_path):
                    os.remove(chunk_path)
            if os.path.exists(temp_dir):
                os.rmdir(temp_dir)
            raise e
