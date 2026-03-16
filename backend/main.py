from __future__ import annotations
import os
import sys
from pathlib import Path as _Path


def _load_env() -> None:
    """Load key=value pairs from .env next to this file into os.environ."""
    env_path = _Path(__file__).resolve().parent / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip()
        if key:
            os.environ.setdefault(key, value)


_load_env()

_CUDA_BIN = os.environ.get("CUDA_BIN", "")
_CUDNN_BIN = os.environ.get("CUDNN_BIN", "")

def _inject_dll_dirs() -> None:
    """Register CUDA / cuDNN directories for DLL resolution."""
    for tag, path in [("CUDA 12.4", _CUDA_BIN), ("cuDNN 9.20", _CUDNN_BIN)]:
        if not os.path.isdir(path):
            print(f"[DLL-inject] WARNING: {tag} directory not found: {path}")
            continue

        if sys.platform == "win32" and hasattr(os, "add_dll_directory"):
            os.add_dll_directory(path)
            print(f"[DLL-inject] os.add_dll_directory registered: {path}")

        current = os.environ.get("PATH", "")
        if path.lower() not in current.lower():
            os.environ["PATH"] = path + os.pathsep + current
            print(f"[DLL-inject] Prepended to PATH: {path}")

    # Diagnostic: verify the exact DLL that ONNX Runtime complains about
    cublas = os.path.join(_CUDA_BIN, "cublasLt64_12.dll")
    cudnn = os.path.join(_CUDNN_BIN, "cudnn64_9.dll")
    print(f"[DLL-inject] cublasLt64_12.dll exists: {os.path.exists(cublas)}  ({cublas})")
    print(f"[DLL-inject] cudnn64_9.dll     exists: {os.path.exists(cudnn)}  ({cudnn})")

_inject_dll_dirs()
# ---------------------------------------------------------------------------

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from api.routes.process import router as process_router
from api.routes.sheets import router as sheets_router
from core.config import (
    APP_TITLE,
    CORS_ALLOW_CREDENTIALS,
    CORS_ALLOW_HEADERS,
    CORS_ALLOW_METHODS,
    CORS_ALLOW_ORIGINS,
    UPLOADS_DIR,
)
from db.database import init_db
from services.omr_service import initialize_omr_runtime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("piano_vision")

app = FastAPI(title=APP_TITLE)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_credentials=CORS_ALLOW_CREDENTIALS,
    allow_methods=CORS_ALLOW_METHODS,
    allow_headers=CORS_ALLOW_HEADERS,
)

UPLOADS_DIR.mkdir(exist_ok=True)


@app.on_event("startup")
def startup() -> None:
    init_db()
    initialize_omr_runtime()


app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

app.include_router(process_router)
app.include_router(sheets_router)
