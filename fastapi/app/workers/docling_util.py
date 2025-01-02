import easyocr
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption, WordFormatOption
from docling.pipeline.simple_pipeline import SimplePipeline
from docling.pipeline.standard_pdf_pipeline import StandardPdfPipeline


class DoclingService:
    """
    A small utility class that handles:
      - Initializing the EasyOCR reader
      - Initializing the Docling DocumentConverter with the formats you need
      - Converting a file to text/markdown
    """

    def __init__(
        self,
        model_storage_directory: str = "/root/.EasyOCR/model",
        pipeline_artifacts_path: str = "/app/models"
    ):
        # Initialize EasyOCR
        self.reader = easyocr.Reader(['en'], model_storage_directory=model_storage_directory)

        # Set up Docling PDF pipeline options
        pipeline_options = PdfPipelineOptions(artifacts_path=pipeline_artifacts_path)

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
        result = self.converter.convert(file_path)
        return result.document.export_to_markdown()
