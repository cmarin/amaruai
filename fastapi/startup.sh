#!/usr/bin/env bash
echo "Starting container..."

echo "Downloading models in the background..."
( 
  python -c "from docling.pipeline.standard_pdf_pipeline import StandardPdfPipeline; \
      StandardPdfPipeline.download_models_hf('/app/models')" \
  && python -c "import easyocr; easyocr.Reader(['en'], model_storage_directory='/root/.EasyOCR/model', download_enabled=True)"
) &

echo "Launching the main process..."
exec python -m app.workers.asset_transcription
