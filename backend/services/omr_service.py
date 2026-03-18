from __future__ import annotations

import asyncio
import json
import logging
import math
import queue
import re
import shutil
import sys
import tempfile
import threading
import time
from argparse import Namespace
from pathlib import Path

import fitz
import onnxruntime as ort
from fastapi import HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from PIL import Image

from core.config import (
    ALLOWED_IMAGE_TYPES,
    ALLOWED_PDF_TYPES,
    MAX_IMAGE_PIXELS,
    MAX_IMAGE_PIXELS_MAX,
    MAX_IMAGE_PIXELS_MIN,
    OMR_CPU_BATCH_SIZE,
    OMR_GPU_BATCH_SIZE,
    OMR_INFERENCE_BATCH_SIZE_MAX,
    OMR_INFERENCE_BATCH_SIZE_MIN,
    PDF_MIN_DPI,
    PDF_MIN_DPI_MAX,
    PDF_MIN_DPI_MIN,
    PDF_RENDER_DPI,
    PDF_RENDER_DPI_MAX,
    PDF_RENDER_DPI_MIN,
)
from db.database import save_sheet
from services.music_service import compute_duration, read_musicxml_notes
from utils.logger import QueueLogHandler, TeeWriter

logger = logging.getLogger("piano_vision")

_oemer_lock = threading.Lock()
_onnx_providers: list[str] = []


class OMRCancelled(Exception):
    """Raised when the client disconnects and the OMR job should stop."""

_PHASE_MAP: list[tuple[str, int]] = [
    ("Extracting staffline and symbols", 5),
    ("Extracting layers of different symbols", 50),
    ("Extracting note groups", 70),
    ("Extracting symbols", 78),
    ("Extracting rhythm", 85),
    ("Building MusicXML", 92),
]


def initialize_omr_runtime() -> None:
    ort.set_default_logger_severity(3)
    log_onnx_runtime()
    threading.Thread(target=preload_oemer, daemon=True).start()


def preload_oemer() -> None:
    try:
        from oemer import ete as _  # noqa: F401

        logger.info("oemer models preloaded successfully")
    except Exception as exc:
        logger.warning("oemer preload failed (will retry on first request): %s", exc)


def log_onnx_runtime() -> None:
    global _onnx_providers

    try:
        _onnx_providers = ort.get_available_providers()
        device = ort.get_device()
        using_cuda = "CUDAExecutionProvider" in _onnx_providers
        runtime_target = "CUDA" if using_cuda else "CPU"
        logger.info(
            "ONNX Runtime target=%s device=%s providers=%s",
            runtime_target,
            device,
            _onnx_providers,
        )
        if not using_cuda:
            logger.warning(
                "CUDAExecutionProvider not available. OMR will run on CPU with reduced batch size."
            )
    except Exception as exc:
        _onnx_providers = []
        logger.warning("Failed to inspect ONNX Runtime providers: %s", exc)


def get_onnx_providers() -> list[str]:
    return list(_onnx_providers)


def _select_omr_batch_size() -> int:
    providers = _onnx_providers or ort.get_available_providers()
    if "CUDAExecutionProvider" in providers:
        return OMR_GPU_BATCH_SIZE
    return OMR_CPU_BATCH_SIZE


def patch_oemer_batch_size(selected_batch_size: int | None = None) -> None:
    try:
        from oemer import ete
        from oemer import inference as inference_mod

        if selected_batch_size is None:
            selected_batch_size = _select_omr_batch_size()
        if getattr(ete, "_pv_batch_size", None) == selected_batch_size:
            return

        original = getattr(inference_mod, "_pv_original_inference", inference_mod.inference)
        inference_mod._pv_original_inference = original

        def _patched_inference(
            model_path: str,
            img_path: str,
            step_size: int = 128,
            batch_size: int = 16,
            manual_th=None,
            use_tf: bool = False,
        ):
            return original(
                model_path,
                img_path,
                step_size=step_size,
                batch_size=selected_batch_size,
                manual_th=manual_th,
                use_tf=use_tf,
            )

        inference_mod.inference = _patched_inference
        ete.inference = _patched_inference
        ete._pv_batch_size = selected_batch_size
        logger.info("Patched oemer inference batch size to %d", selected_batch_size)
    except Exception as exc:
        logger.warning("Could not patch oemer batch size: %s", exc)


def _estimate_progress(
    line: str,
    current_phase_progress: int,
    page_base: int = 0,
    page_span: int = 100,
) -> int:
    raw = current_phase_progress

    for phrase, pct in _PHASE_MAP:
        if phrase.lower() in line.lower():
            raw = pct
            break
    else:
        match = re.match(r"(\d+)/(\d+)", line)
        if match:
            cur, total = int(match.group(1)), int(match.group(2))
            frac = cur / total if total else 0
            if current_phase_progress < 50:
                raw = int(5 + frac * 44)
            else:
                raw = int(50 + frac * 34)

    return int(page_base + (raw / 100) * page_span)


def _is_pdf(filename: str, content_type: str | None) -> bool:
    if content_type and content_type in ALLOWED_PDF_TYPES:
        return True
    return Path(filename).suffix.lower() == ".pdf"


def _pdf_to_images(
    pdf_path: Path,
    output_dir: Path,
    render_dpi: int,
    min_dpi: int,
    max_pixels: int,
) -> list[Path]:
    doc = fitz.open(str(pdf_path))
    image_paths: list[Path] = []
    try:
        for index, page in enumerate(doc):
            width_inches = page.rect.width / 72.0
            height_inches = page.rect.height / 72.0
            base_pixels = (width_inches * render_dpi) * (height_inches * render_dpi)
            if base_pixels > max_pixels:
                scale = math.sqrt(max_pixels / base_pixels)
                dpi = max(min_dpi, int(render_dpi * scale))
            else:
                dpi = render_dpi
            pix = page.get_pixmap(dpi=dpi)
            img_path = output_dir / f"page_{index + 1:03d}.png"
            pix.save(str(img_path))
            image_paths.append(img_path)
    finally:
        doc.close()
    return image_paths


def _downscale_image_if_needed(img_path: Path, max_pixels: int) -> Path:
    with Image.open(img_path) as image:
        width, height = image.size
        pixels = width * height
        if pixels <= max_pixels:
            return img_path
        ratio = math.sqrt(max_pixels / pixels)
        new_size = (max(1, int(width * ratio)), max(1, int(height * ratio)))
        resized = image.resize(new_size, Image.Resampling.LANCZOS)
        resized.save(img_path)
    return img_path


def _clamp_int(value: int | None, min_value: int, max_value: int, default: int) -> int:
    if value is None:
        return default
    return max(min_value, min(max_value, value))


def _resolve_settings(overrides: dict | None) -> dict:
    overrides = overrides or {}
    render_dpi = _clamp_int(
        overrides.get("pdf_render_dpi"),
        PDF_RENDER_DPI_MIN,
        PDF_RENDER_DPI_MAX,
        PDF_RENDER_DPI,
    )
    min_dpi = _clamp_int(
        overrides.get("pdf_min_dpi"),
        PDF_MIN_DPI_MIN,
        PDF_MIN_DPI_MAX,
        PDF_MIN_DPI,
    )
    if min_dpi > render_dpi:
        min_dpi = render_dpi
    max_pixels = _clamp_int(
        overrides.get("max_image_pixels"),
        MAX_IMAGE_PIXELS_MIN,
        MAX_IMAGE_PIXELS_MAX,
        MAX_IMAGE_PIXELS,
    )
    batch_size = _clamp_int(
        overrides.get("inference_batch_size"),
        OMR_INFERENCE_BATCH_SIZE_MIN,
        OMR_INFERENCE_BATCH_SIZE_MAX,
        _select_omr_batch_size(),
    )
    return {
        "preset": overrides.get("preset"),
        "pdf_render_dpi": render_dpi,
        "pdf_min_dpi": min_dpi,
        "max_image_pixels": max_pixels,
        "inference_batch_size": batch_size,
    }


def _sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def process_sheet_upload(
    file: UploadFile,
    request: Request,
    settings: dict | None = None,
) -> StreamingResponse:
    content_type = file.content_type
    filename = file.filename or "sheet.png"

    is_pdf = _is_pdf(filename, content_type)
    if not is_pdf and content_type and content_type not in ALLOWED_IMAGE_TYPES:
        if not content_type.startswith("image/"):
            raise HTTPException(
                status_code=400,
                detail=f"Expected an image or PDF file, got {content_type}",
            )

    tmp_dir = Path(tempfile.mkdtemp(prefix="piano_vision_"))
    suffix = Path(filename).suffix or ".png"
    input_path = tmp_dir / f"input{suffix}"
    with open(input_path, "wb") as output_file:
        shutil.copyfileobj(file.file, output_file)

    oemer_output_dir = tmp_dir / "oemer_output"
    oemer_output_dir.mkdir()

    log_queue: queue.Queue[str] = queue.Queue()
    result: dict = {"notes": None, "error": None, "cancelled": False}
    cancel_event = threading.Event()

    resolved_settings = _resolve_settings(settings)

    def _run_oemer() -> None:
        old_stdout, old_stderr = sys.stdout, sys.stderr
        sys.stdout = TeeWriter(old_stdout, log_queue)  # type: ignore[assignment]
        sys.stderr = TeeWriter(old_stderr, log_queue)  # type: ignore[assignment]

        handler = QueueLogHandler(log_queue)
        handler.setFormatter(logging.Formatter("%(message)s"))
        oemer_logger = logging.getLogger("oemer")
        oemer_logger.addHandler(handler)

        try:
            from oemer.ete import clear_data, extract

            patch_oemer_batch_size(resolved_settings["inference_batch_size"])

            if cancel_event.is_set():
                raise OMRCancelled()

            if is_pdf:
                started_conversion = time.perf_counter()
                log_queue.put("Converting PDF pages to images...")
                pages_dir = tmp_dir / "pages"
                pages_dir.mkdir()
                image_paths = _pdf_to_images(
                    input_path,
                    pages_dir,
                    resolved_settings["pdf_render_dpi"],
                    resolved_settings["pdf_min_dpi"],
                    resolved_settings["max_image_pixels"],
                )
                log_queue.put(f"PDF has {len(image_paths)} page(s)")
                log_queue.put(
                    f"Rendered PDF pages in {time.perf_counter() - started_conversion:.1f}s "
                    f"(base DPI={resolved_settings['pdf_render_dpi']}, "
                    f"min DPI={resolved_settings['pdf_min_dpi']})"
                )
                skip_deskew = True
            else:
                image_paths = [input_path]
                skip_deskew = False

            total_pages = len(image_paths)
            all_notes: list[dict] = []
            time_offset = 0.0
            started_all = time.perf_counter()

            for path in image_paths:
                if cancel_event.is_set():
                    raise OMRCancelled()
                _downscale_image_if_needed(path, resolved_settings["max_image_pixels"])

            provider_line = ", ".join(get_onnx_providers()) or "unknown"
            log_queue.put(f"ONNX providers: {provider_line}")
            if "CUDAExecutionProvider" in get_onnx_providers():
                log_queue.put(
                    f"Using CUDA batch size {resolved_settings['inference_batch_size']}"
                )
            else:
                log_queue.put(
                    "Using CPU batch size "
                    f"{resolved_settings['inference_batch_size']} to avoid RAM thrashing"
                )

            with _oemer_lock:
                for page_index, img_path in enumerate(image_paths):
                    if cancel_event.is_set():
                        raise OMRCancelled()

                    page_num = page_index + 1
                    started_page = time.perf_counter()
                    log_queue.put(f"Processing page {page_num}/{total_pages}...")

                    page_output = oemer_output_dir / f"page_{page_num:03d}"
                    page_output.mkdir()

                    args = Namespace(
                        img_path=str(img_path),
                        output_path=str(page_output),
                        use_tf=False,
                        save_cache=False,
                        without_deskew=skip_deskew,
                    )
                    clear_data()
                    musicxml_path = extract(args)

                    if cancel_event.is_set():
                        raise OMRCancelled()

                    page_notes = read_musicxml_notes(str(musicxml_path))
                    if page_notes:
                        min_start = min(note["start"] for note in page_notes)
                        if min_start > 0:
                            for note in page_notes:
                                note["start"] = max(0.0, note["start"] - min_start)

                        page_duration = compute_duration(page_notes)
                        for note in page_notes:
                            note["start"] = round(note["start"] + time_offset, 4)
                        time_offset += page_duration + 0.5
                    else:
                        page_duration = 0.0

                    all_notes.extend(page_notes)
                    elapsed_page = time.perf_counter() - started_page
                    log_queue.put(
                        f"Finished page {page_num}/{total_pages} in {elapsed_page:.1f}s "
                        f"({len(page_notes)} note(s))"
                    )

            all_notes.sort(key=lambda note: (note["start"], note["pitch"]))
            elapsed_all = time.perf_counter() - started_all
            log_queue.put(f"OMR completed in {elapsed_all:.1f}s for {total_pages} page(s)")
            result["notes"] = all_notes
        except OMRCancelled:
            result["cancelled"] = True
            logger.info("OMR processing cancelled by client")
        except Exception as exc:
            result["error"] = str(exc)
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr
            oemer_logger.removeHandler(handler)

    async def _event_stream():
        thread = threading.Thread(target=_run_oemer, daemon=True)
        thread.start()

        progress = 0
        total_pages = 1
        page_base = 0
        page_span = 100

        yield _sse_event({"type": "log", "message": "Starting OMR processing...", "progress": 0})

        while thread.is_alive():
            if await request.is_disconnected():
                cancel_event.set()
                logger.info("Client disconnected, cancelling OMR")
                break

            while not log_queue.empty():
                try:
                    message = log_queue.get_nowait()

                    page_count_match = re.match(r"PDF has (\d+) page", message)
                    if page_count_match:
                        total_pages = int(page_count_match.group(1))
                        page_span = 100 // total_pages

                    page_match = re.match(r"Processing page (\d+)/(\d+)", message)
                    if page_match:
                        current_page = int(page_match.group(1))
                        page_base = (current_page - 1) * page_span
                        progress = page_base

                    progress = _estimate_progress(message, progress - page_base, page_base, page_span)
                    progress = min(progress, 99)
                    yield _sse_event({"type": "log", "message": message, "progress": progress})
                except queue.Empty:
                    break
            await asyncio.sleep(0.3)

        # Wait for the worker thread to finish after cancellation
        thread.join(timeout=10)

        if cancel_event.is_set():
            shutil.rmtree(tmp_dir, ignore_errors=True)
            return

        while not log_queue.empty():
            try:
                message = log_queue.get_nowait()
                progress = _estimate_progress(message, progress - page_base, page_base, page_span)
                progress = min(progress, 99)
                yield _sse_event({"type": "log", "message": message, "progress": progress})
            except queue.Empty:
                break

        if result["error"]:
            yield _sse_event({"type": "error", "message": result["error"], "progress": progress})
        else:
            notes = result["notes"] or []
            duration = compute_duration(notes)
            sheet_id = save_sheet(filename, notes, duration)
            logger.info("Saved sheet %d with %d notes", sheet_id, len(notes))
            yield _sse_event(
                {
                    "type": "done",
                    "notes": notes,
                    "sheetId": sheet_id,
                    "progress": 100,
                }
            )

        shutil.rmtree(tmp_dir, ignore_errors=True)

    return StreamingResponse(_event_stream(), media_type="text/event-stream")