from __future__ import annotations

from fastapi import APIRouter, File, Form, Request, UploadFile

from services.omr_service import process_sheet_upload

router = APIRouter()


@router.post("/process-sheet")
async def process_sheet(
    request: Request,
    file: UploadFile = File(...),
    preset: str | None = Form(None),
    pdf_render_dpi: int | None = Form(None),
    pdf_min_dpi: int | None = Form(None),
    max_image_pixels: int | None = Form(None),
    inference_batch_size: int | None = Form(None),
):
    settings = {
        "preset": preset,
        "pdf_render_dpi": pdf_render_dpi,
        "pdf_min_dpi": pdf_min_dpi,
        "max_image_pixels": max_image_pixels,
        "inference_batch_size": inference_batch_size,
    }
    return process_sheet_upload(file, request, settings)