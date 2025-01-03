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

    def extract_audio(self, input_file: str) -> str:
        """
        Extract audio from the given video file and return the path to the audio file (MP3).
        Uses ffmpeg under the hood.
        """
        # Create a unique temporary directory for this extraction
        with tempfile.TemporaryDirectory() as temp_dir:
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

            try:
                logger.debug(f"Extracting audio from video with command: {' '.join(command)}")
                subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                logger.info(f"Audio extracted successfully: {output_file_path}")
                return output_file_path
            except subprocess.CalledProcessError as e:
                logger.error(f"Failed to extract audio from video: {e.stderr.decode('utf-8', errors='ignore')}")
                raise
