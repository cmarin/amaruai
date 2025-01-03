import os
import uuid
import tempfile
import logging
from typing import List

import whisper

logger = logging.getLogger(__name__)

MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB in bytes


class WhisperService:
    """
    Utility for transcribing MP3/WAV files using Whisper, with support for splitting
    large files into 25MB chunks.
    """

    def __init__(self, model_name: str = "medium"):
        """
        :param model_name: The name of the Whisper model to load, e.g. "turbo", "base", "small", etc.
        """
        logger.info(f"Loading Whisper model '{model_name}'...")
        self.model = whisper.load_model(model_name)
        logger.info(f"Whisper model '{model_name}' loaded successfully.")

    def transcribe_audio(self, file_path: str) -> str:
        """
        1. Splits large files into <= 25 MB chunks
        2. Transcribes each chunk with Whisper
        3. Concatenates the transcribed text
        :param file_path: Path to the input audio file (mp3/wav).
        :return: Full transcription text from all chunks.
        """
        file_size = os.path.getsize(file_path)
        if file_size <= MAX_FILE_SIZE_BYTES:
            # If file fits within 25MB, transcribe it directly
            return self._transcribe_single_chunk(file_path)
        else:
            # If file > 25MB, split into multiple chunks
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
        Transcribe a single audio chunk via Whisper.
        :param chunk_path: Filepath of a chunk
        :return: Transcribed text
        """
        logger.debug(f"Transcribing chunk {chunk_path} via Whisper...")
        result = self.model.transcribe(chunk_path)
        return result.get("text", "")

    def _split_audio_file(self, file_path: str) -> List[str]:
        """
        Split a large audio file into multiple chunks (each <= 25MB).
        Returns a list of chunk file paths.
        """
        chunks = []
        file_size = os.path.getsize(file_path)
        # Calculate how many chunks we need
        num_chunks = (file_size // MAX_FILE_SIZE_BYTES) + 1
        bytes_per_chunk = file_size // num_chunks + 1

        logger.info(
            f"Splitting audio file '{file_path}' of size {file_size} bytes "
            f"into {num_chunks} chunk(s) (<=25MB each)."
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
