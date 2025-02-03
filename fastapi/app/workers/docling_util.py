import easyocr
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption, WordFormatOption
from docling.pipeline.simple_pipeline import SimplePipeline
from docling.pipeline.standard_pdf_pipeline import StandardPdfPipeline
from uuid import UUID
import os
from pathlib import Path
import logging


class DoclingService:
    """
    A small utility class that handles:
      - Initializing the EasyOCR reader
      - Initializing the Docling DocumentConverter with the formats you need
      - Converting a file to text/markdown
    """

    def __init__(
        self,
        model_storage_directory: str = "/tmp/.EasyOCR/model",
        pipeline_artifacts_path: str = "/tmp/models"
    ):
        # Create directories
        os.makedirs(model_storage_directory, exist_ok=True)
        os.makedirs(pipeline_artifacts_path, exist_ok=True)
        
        # Set environment variable for EasyOCR
        os.environ['EASYOCR_MODULE_PATH'] = os.path.dirname(model_storage_directory)
        
        # Initialize EasyOCR with the correct path
        self.reader = easyocr.Reader(
            ['en'], 
            model_storage_directory=model_storage_directory,
            download_enabled=True  # Enable downloads since we're using a writable path
        )

        # Set up Docling PDF pipeline options
        pipeline_options = PdfPipelineOptions(
            artifacts_path=pipeline_artifacts_path,
            ocr_model_path=model_storage_directory
        )

        # Create the DocumentConverter with multiple supported input formats
        self.converter = DocumentConverter(
            allowed_formats=[
                InputFormat.PDF,
                InputFormat.DOCX,
                InputFormat.PPTX,
                InputFormat.HTML,
                InputFormat.IMAGE
            ],
            format_options={
                InputFormat.PDF: PdfFormatOption(
                    pipeline_options=pipeline_options
                ),
                InputFormat.DOCX: WordFormatOption(
                    pipeline_cls=SimplePipeline
                )
            }
        )

    def convert_file(self, file_path: str) -> str:
        """
        Convert the given file to Markdown text using Docling.
        Returns the extracted text.
        """
        try:
            result = self.converter.convert(file_path)
            return result.document.export_to_markdown()
        except Exception as e:
            logging.error(f"Error converting file: {str(e)}")
            raise

    def process_with_persona(self, text: str, persona_id: UUID) -> str:
        """
        Process text with a specific persona.
        
        Args:
            text (str): Text to process
            persona_id (UUID): ID of the persona to use
            
        Returns:
            str: Processed text
        """
        # Implement the actual processing logic here
        return text
