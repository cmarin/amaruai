import subprocess
import os
import logging
import tempfile

logger = logging.getLogger(__name__)

class VideoService:
    """
    Utility for extracting audio from video files (e.g., MP4, MOV) using FFmpeg.
    """

    def __init__(self):
        pass  # If you need any class-level initialization, do it here

    def extract_audio(self, input_file: str) -> tuple[str, str]:
        """
        Extract audio from the given video file and return the path to the audio file (MP3).
        Uses ffmpeg under the hood.
        Returns: Tuple of (file_path, temp_dir_path)
        """
        # Create a unique temporary directory for this extraction
        temp_dir = tempfile.mkdtemp(prefix="video_audio_")
        try:
            base_name = os.path.splitext(os.path.basename(input_file))[0]
            output_file_path = os.path.join(temp_dir, f"{base_name}.mp3")

            # ffmpeg command: -i input.mp4 -vn -acodec libmp3lame output.mp3
            command = [
                "ffmpeg",
                "-i", input_file,
                "-vn",  # no video
                "-acodec", "libmp3lame",
                "-q:a", "2",  # audio quality
                "-y",  # overwrite output file if it exists
                output_file_path
            ]

            logger.debug(f"Extracting audio from video with command: {' '.join(command)}")
            subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            logger.info(f"Audio extracted successfully: {output_file_path}")
            return output_file_path, temp_dir
        except Exception as e:
            # Clean up temp directory on error
            if os.path.exists(temp_dir):
                import shutil
                shutil.rmtree(temp_dir)
            logger.error(f"Failed to extract audio from video: {str(e)}")
            raise
