from __future__ import annotations

from fastapi import APIRouter, File, Request, UploadFile

from services.omr_service import process_sheet_upload

router = APIRouter()


@router.post("/process-sheet")
async def process_sheet(request: Request, file: UploadFile = File(...)):
    return process_sheet_upload(file, request)