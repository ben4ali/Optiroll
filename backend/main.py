from __future__ import annotations

import asyncio
import io
import json
import logging
import queue
import re
import shutil
import sys
import tempfile
import threading
import uuid
from argparse import Namespace
from pathlib import Path

import fitz  # PyMuPDF
import muspy
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from database import (
    delete_sheet,
    get_all_sheets,
    get_sheet,
    get_sheet_notes,
    init_db,
    save_sheet,
    set_sheet_image,
    update_sheet,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("piano_vision")

app = FastAPI(title="Piano Vision API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOADS_DIR = Path(__file__).parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

# oemer uses module-level global state (layers._layers), so only one
# processing run can happen at a time.  This lock serialises access.
_oemer_lock = threading.Lock()

# Allowed MIME types
_ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/tiff", "image/bmp", "image/webp"}
_ALLOWED_PDF_TYPES = {"application/pdf"}
_PDF_RENDER_DPI = 250  # Good balance between quality and speed


@app.on_event("startup")
def startup() -> None:
    init_db()
    # Preload oemer ONNX models so the first request doesn't pay the import +
    # model-loading cost.  Run in a daemon thread so it doesn't block startup.
    threading.Thread(target=_preload_oemer, daemon=True).start()


def _preload_oemer() -> None:
    """Import oemer eagerly so ONNX sessions are created once at startup."""
    try:
        from oemer import ete as _  # noqa: F401
        logger.info("oemer models preloaded successfully")
    except Exception as exc:
        logger.warning("oemer preload failed (will retry on first request): %s", exc)


# Serve uploaded images
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

DEFAULT_TEMPO_BPM = 120.0


class _QueueLogHandler(logging.Handler):
    """Logging handler that pushes formatted records into a queue."""

    def __init__(self, q: queue.Queue[str]) -> None:
        super().__init__()
        self.q = q

    def emit(self, record: logging.LogRecord) -> None:
        self.q.put(self.format(record))


class _TeeWriter:
    """Wraps stdout/stderr to tee output into a queue while keeping console output."""

    def __init__(self, original: io.TextIOBase, q: queue.Queue[str]) -> None:
        self.original = original
        self.q = q
        self._buf = ""

    def write(self, s: str) -> int:
        self.original.write(s)
        self._buf += s
        while "\n" in self._buf:
            line, self._buf = self._buf.split("\n", 1)
            stripped = line.strip()
            if stripped:
                self.q.put(stripped)
        return len(s)

    def flush(self) -> None:
        if self._buf.strip():
            self.q.put(self._buf.strip())
            self._buf = ""
        self.original.flush()

    def __getattr__(self, name: str):  # type: ignore[override]
        return getattr(self.original, name)


# Progress estimation based on oemer log messages
_PHASE_MAP: list[tuple[str, int]] = [
    ("Extracting staffline and symbols", 5),
    ("Extracting layers of different symbols", 50),
    ("Extracting note groups", 70),
    ("Extracting symbols", 78),
    ("Extracting rhythm", 85),
    ("Building MusicXML", 92),
]


def _estimate_progress(
    line: str,
    current_phase_progress: int,
    page_base: int = 0,
    page_span: int = 100,
) -> int:
    """Parse a log line and return an estimated progress percentage.

    When processing multiple pages, *page_base* is the progress value at the
    start of the current page and *page_span* is how many percentage points
    this page is worth.  All oemer-internal percentages (0-100) are scaled
    into the [page_base, page_base+page_span] range.
    """
    raw = current_phase_progress  # fall-through value

    for phrase, pct in _PHASE_MAP:
        if phrase.lower() in line.lower():
            raw = pct
            break
    else:
        # Neural network progress: "193/240 (step: 16)"
        m = re.match(r"(\d+)/(\d+)", line)
        if m:
            cur, total = int(m.group(1)), int(m.group(2))
            frac = cur / total if total else 0
            if current_phase_progress < 50:
                raw = int(5 + frac * 44)  # 5% → 49%
            else:
                raw = int(50 + frac * 34)  # 50% → 84%

    # Scale into the page's progress window
    return int(page_base + (raw / 100) * page_span)


def _parse_score_to_notes(score: muspy.Music) -> list[dict]:
    bpm = DEFAULT_TEMPO_BPM
    if score.tempos:
        bpm = score.tempos[0].qpm or DEFAULT_TEMPO_BPM

    resolution = score.resolution if score.resolution else 480
    seconds_per_tick = 60.0 / (bpm * resolution)

    notes: list[dict] = []
    for track in score.tracks:
        for note in track.notes:
            start_sec = note.time * seconds_per_tick
            dur_sec = note.duration * seconds_per_tick
            if dur_sec <= 0:
                continue
            notes.append(
                {
                    "pitch": note.pitch,
                    "start": round(start_sec, 4),
                    "duration": round(dur_sec, 4),
                }
            )

    notes.sort(key=lambda n: (n["start"], n["pitch"]))
    return notes


def _compute_duration(notes: list[dict]) -> float:
    if not notes:
        return 0.0
    return max(n["start"] + n["duration"] for n in notes)


def _is_pdf(filename: str, content_type: str | None) -> bool:
    """Check if the upload is a PDF by extension or MIME type."""
    if content_type and content_type in _ALLOWED_PDF_TYPES:
        return True
    return Path(filename).suffix.lower() == ".pdf"


def _pdf_to_images(pdf_path: Path, output_dir: Path) -> list[Path]:
    """Convert each page of a PDF to a PNG image using PyMuPDF."""
    doc = fitz.open(str(pdf_path))
    image_paths: list[Path] = []
    for i, page in enumerate(doc):
        pix = page.get_pixmap(dpi=_PDF_RENDER_DPI)
        img_path = output_dir / f"page_{i + 1:03d}.png"
        pix.save(str(img_path))
        image_paths.append(img_path)
    doc.close()
    return image_paths


# ---------------------------------------------------------------------------
# SSE streaming endpoint
# ---------------------------------------------------------------------------


def _sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


@app.post("/process-sheet")
async def process_sheet(file: UploadFile = File(...)):
    content_type = file.content_type
    fname = file.filename or "sheet.png"

    # Validate file type
    is_pdf = _is_pdf(fname, content_type)
    if not is_pdf:
        if content_type and content_type not in _ALLOWED_IMAGE_TYPES:
            # Be lenient: also accept any image/* prefix
            if not content_type.startswith("image/"):
                raise HTTPException(
                    status_code=400,
                    detail=f"Expected an image or PDF file, got {content_type}",
                )

    tmp_dir = Path(tempfile.mkdtemp(prefix="piano_vision_"))
    suffix = Path(fname).suffix or ".png"
    input_path = tmp_dir / f"input{suffix}"
    with open(input_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    oemer_output_dir = tmp_dir / "oemer_output"
    oemer_output_dir.mkdir()

    log_queue: queue.Queue[str] = queue.Queue()
    result: dict = {"notes": None, "error": None}

    def _run_oemer() -> None:
        # Capture stdout/stderr from oemer
        old_stdout, old_stderr = sys.stdout, sys.stderr
        sys.stdout = _TeeWriter(old_stdout, log_queue)  # type: ignore[assignment]
        sys.stderr = _TeeWriter(old_stderr, log_queue)  # type: ignore[assignment]

        # Attach handler to oemer loggers
        handler = _QueueLogHandler(log_queue)
        handler.setFormatter(logging.Formatter("%(message)s"))
        oemer_logger = logging.getLogger("oemer")
        oemer_logger.addHandler(handler)

        try:
            from oemer.ete import clear_data, extract

            # Determine the list of images to process
            if is_pdf:
                log_queue.put("Converting PDF pages to images...")
                pages_dir = tmp_dir / "pages"
                pages_dir.mkdir()
                image_paths = _pdf_to_images(input_path, pages_dir)
                log_queue.put(f"PDF has {len(image_paths)} page(s)")
                skip_deskew = True  # PDFs are already straight
            else:
                image_paths = [input_path]
                skip_deskew = False  # Images might be camera photos

            total_pages = len(image_paths)
            all_notes: list[dict] = []
            time_offset = 0.0

            with _oemer_lock:
                for page_idx, img_path in enumerate(image_paths):
                    page_num = page_idx + 1
                    log_queue.put(
                        f"Processing page {page_num}/{total_pages}..."
                    )

                    # Each page gets its own oemer output subdir
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

                    score = muspy.read(str(musicxml_path))
                    page_notes = _parse_score_to_notes(score)

                    # Offset this page's notes by the cumulative duration
                    for n in page_notes:
                        n["start"] = round(n["start"] + time_offset, 4)

                    page_duration = _compute_duration(page_notes) if page_notes else 0.0
                    # Add a small gap between pages so they don't overlap
                    if page_notes:
                        time_offset = page_duration + 0.5

                    all_notes.extend(page_notes)

            all_notes.sort(key=lambda n: (n["start"], n["pitch"]))
            result["notes"] = all_notes

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
        total_pages = 1  # Will be updated from log messages
        current_page = 0
        page_base = 0
        page_span = 100

        yield _sse_event({"type": "log", "message": "Starting OMR processing...", "progress": 0})

        while thread.is_alive():
            while not log_queue.empty():
                try:
                    msg = log_queue.get_nowait()

                    # Detect page count from log messages
                    m_pages = re.match(r"PDF has (\d+) page", msg)
                    if m_pages:
                        total_pages = int(m_pages.group(1))
                        page_span = 100 // total_pages

                    m_page = re.match(r"Processing page (\d+)/(\d+)", msg)
                    if m_page:
                        current_page = int(m_page.group(1))
                        page_base = (current_page - 1) * page_span
                        # Reset inner progress for this page
                        progress = page_base

                    progress = _estimate_progress(msg, progress - page_base, page_base, page_span)
                    progress = min(progress, 99)  # Don't hit 100 until done
                    yield _sse_event({"type": "log", "message": msg, "progress": progress})
                except queue.Empty:
                    break
            await asyncio.sleep(0.3)

        # Drain remaining messages
        while not log_queue.empty():
            try:
                msg = log_queue.get_nowait()
                progress = _estimate_progress(msg, progress - page_base, page_base, page_span)
                progress = min(progress, 99)
                yield _sse_event({"type": "log", "message": msg, "progress": progress})
            except queue.Empty:
                break

        # Final result
        if result["error"]:
            yield _sse_event({"type": "error", "message": result["error"], "progress": progress})
        else:
            notes = result["notes"] or []
            duration = _compute_duration(notes)
            sheet_id = save_sheet(fname, notes, duration)
            logger.info("Saved sheet %d with %d notes", sheet_id, len(notes))
            yield _sse_event({
                "type": "done",
                "notes": notes,
                "sheetId": sheet_id,
                "progress": 100,
            })

        # Cleanup temp files
        shutil.rmtree(tmp_dir, ignore_errors=True)

    return StreamingResponse(_event_stream(), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# Sheet library CRUD
# ---------------------------------------------------------------------------


@app.get("/sheets")
async def list_sheets():
    return get_all_sheets()


@app.get("/sheets/{sheet_id}")
async def get_sheet_endpoint(sheet_id: int):
    data = get_sheet(sheet_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Sheet not found")
    return data


@app.delete("/sheets/{sheet_id}")
async def remove_sheet(sheet_id: int):
    if not delete_sheet(sheet_id):
        raise HTTPException(status_code=404, detail="Sheet not found")
    return {"ok": True}


class SheetUpdate(BaseModel):
    name: str | None = None
    author: str | None = None


@app.patch("/sheets/{sheet_id}")
async def patch_sheet(sheet_id: int, body: SheetUpdate):
    if not update_sheet(sheet_id, name=body.name, author=body.author):
        raise HTTPException(status_code=404, detail="Sheet not found")
    return {"ok": True}


@app.post("/sheets/{sheet_id}/image")
async def upload_sheet_image(sheet_id: int, file: UploadFile = File(...)):
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Expected an image file")

    ext = Path(file.filename or "image.jpg").suffix or ".jpg"
    unique_name = f"{sheet_id}_{uuid.uuid4().hex[:8]}{ext}"
    dest = UPLOADS_DIR / unique_name
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    set_sheet_image(sheet_id, unique_name)
    return {"ok": True, "image_filename": unique_name}
