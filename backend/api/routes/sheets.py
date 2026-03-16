from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from core.config import UPLOADS_DIR
from db.database import delete_sheet, get_all_sheets, get_sheet, set_sheet_image, update_sheet

router = APIRouter(prefix="/sheets")


class SheetUpdate(BaseModel):
    name: str | None = None
    author: str | None = None


@router.get("")
async def list_sheets():
    return get_all_sheets()


@router.get("/{sheet_id}")
async def get_sheet_endpoint(sheet_id: int):
    data = get_sheet(sheet_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Sheet not found")
    return data


@router.delete("/{sheet_id}")
async def remove_sheet(sheet_id: int):
    if not delete_sheet(sheet_id):
        raise HTTPException(status_code=404, detail="Sheet not found")
    return {"ok": True}


@router.patch("/{sheet_id}")
async def patch_sheet(sheet_id: int, body: SheetUpdate):
    if not update_sheet(sheet_id, name=body.name, author=body.author):
        raise HTTPException(status_code=404, detail="Sheet not found")
    return {"ok": True}


@router.post("/{sheet_id}/image")
async def upload_sheet_image(sheet_id: int, file: UploadFile = File(...)):
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Expected an image file")

    ext = Path(file.filename or "image.jpg").suffix or ".jpg"
    unique_name = f"{sheet_id}_{uuid.uuid4().hex[:8]}{ext}"
    dest = UPLOADS_DIR / unique_name
    with open(dest, "wb") as output_file:
        shutil.copyfileobj(file.file, output_file)

    set_sheet_image(sheet_id, unique_name)
    return {"ok": True, "image_filename": unique_name}