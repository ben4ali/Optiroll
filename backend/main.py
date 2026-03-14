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
from argparse import Namespace
from pathlib import Path

import muspy
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from database import delete_sheet, get_all_sheets, get_sheet_notes, init_db, save_sheet

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


@app.on_event("startup")
def startup() -> None:
    init_db()


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


def _estimate_progress(line: str, current_phase_progress: int) -> int:
    """Parse a log line and return an estimated progress percentage."""
    for phrase, pct in _PHASE_MAP:
        if phrase.lower() in line.lower():
            return pct

    # Neural network progress: "193/240 (step: 16)"
    m = re.match(r"(\d+)/(\d+)", line)
    if m:
        cur, total = int(m.group(1)), int(m.group(2))
        frac = cur / total if total else 0
        if current_phase_progress < 50:
            return int(5 + frac * 44)  # 5% → 49%
        else:
            return int(50 + frac * 34)  # 50% → 84%

    return current_phase_progress


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


# ---------------------------------------------------------------------------
# SSE streaming endpoint
# ---------------------------------------------------------------------------


def _sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


@app.post("/process-sheet")
async def process_sheet(file: UploadFile = File(...)):
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"Expected an image file, got {file.content_type}",
        )

    tmp_dir = Path(tempfile.mkdtemp(prefix="piano_vision_"))
    suffix = Path(file.filename or "sheet.png").suffix or ".png"
    image_path = tmp_dir / f"input{suffix}"
    with open(image_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    oemer_output_dir = tmp_dir / "oemer_output"
    oemer_output_dir.mkdir()
    filename = file.filename or "sheet.png"

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

            args = Namespace(
                img_path=str(image_path),
                output_path=str(oemer_output_dir),
                use_tf=False,
                save_cache=False,
                without_deskew=False,
            )
            clear_data()
            musicxml_path = extract(args)

            score = muspy.read(str(musicxml_path))
            result["notes"] = _parse_score_to_notes(score)
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

        yield _sse_event({"type": "log", "message": "Starting OMR processing...", "progress": 0})

        while thread.is_alive():
            while not log_queue.empty():
                try:
                    msg = log_queue.get_nowait()
                    progress = _estimate_progress(msg, progress)
                    yield _sse_event({"type": "log", "message": msg, "progress": progress})
                except queue.Empty:
                    break
            await asyncio.sleep(0.3)

        # Drain remaining messages
        while not log_queue.empty():
            try:
                msg = log_queue.get_nowait()
                progress = _estimate_progress(msg, progress)
                yield _sse_event({"type": "log", "message": msg, "progress": progress})
            except queue.Empty:
                break

        # Final result
        if result["error"]:
            yield _sse_event({"type": "error", "message": result["error"], "progress": progress})
        else:
            notes = result["notes"] or []
            sheet_id = save_sheet(filename, notes)
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
async def get_sheet(sheet_id: int):
    notes = get_sheet_notes(sheet_id)
    if notes is None:
        raise HTTPException(status_code=404, detail="Sheet not found")
    return notes


@app.delete("/sheets/{sheet_id}")
async def remove_sheet(sheet_id: int):
    if not delete_sheet(sheet_id):
        raise HTTPException(status_code=404, detail="Sheet not found")
    return {"ok": True}
