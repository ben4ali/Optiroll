from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"
DB_PATH = BASE_DIR / "piano_vision.db"

APP_TITLE = "Piano Vision API"
DEFAULT_TEMPO_BPM = 120.0

ALLOWED_IMAGE_TYPES = {
    "image/png",
    "image/jpeg",
    "image/tiff",
    "image/bmp",
    "image/webp",
}
ALLOWED_PDF_TYPES = {"application/pdf"}

PDF_RENDER_DPI = int(os.getenv("OMR_PDF_RENDER_DPI", "150"))
PDF_MIN_DPI = int(os.getenv("OMR_PDF_MIN_DPI", "100"))
MAX_IMAGE_PIXELS = int(os.getenv("OMR_MAX_IMAGE_PIXELS", "2500000"))

PDF_RENDER_DPI_MIN = 72
PDF_RENDER_DPI_MAX = 240
PDF_MIN_DPI_MIN = 72
PDF_MIN_DPI_MAX = 200
MAX_IMAGE_PIXELS_MIN = 800_000
MAX_IMAGE_PIXELS_MAX = 6_000_000
OMR_INFERENCE_BATCH_SIZE_MIN = 4
OMR_INFERENCE_BATCH_SIZE_MAX = 64

OMR_GPU_BATCH_SIZE = int(os.getenv("OMR_INFERENCE_GPU_BATCH_SIZE", "16"))
OMR_CPU_BATCH_SIZE = int(os.getenv("OMR_INFERENCE_CPU_BATCH_SIZE", "8"))

CORS_ALLOW_ORIGINS = ["*"]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = ["*"]
CORS_ALLOW_HEADERS = ["*"]