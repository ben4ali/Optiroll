from __future__ import annotations

import json
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "piano_vision.db"


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db() -> None:
    conn = _connect()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS sheets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            notes_json TEXT NOT NULL,
            note_count INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """
    )
    conn.commit()
    conn.close()


def save_sheet(filename: str, notes: list[dict]) -> int:
    conn = _connect()
    cursor = conn.execute(
        "INSERT INTO sheets (filename, notes_json, note_count) VALUES (?, ?, ?)",
        (filename, json.dumps(notes), len(notes)),
    )
    conn.commit()
    sheet_id = cursor.lastrowid
    conn.close()
    return sheet_id  # type: ignore[return-value]


def get_all_sheets() -> list[dict]:
    conn = _connect()
    rows = conn.execute(
        "SELECT id, filename, note_count, created_at FROM sheets ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_sheet_notes(sheet_id: int) -> list[dict] | None:
    conn = _connect()
    row = conn.execute(
        "SELECT notes_json FROM sheets WHERE id = ?", (sheet_id,)
    ).fetchone()
    conn.close()
    if row:
        return json.loads(row["notes_json"])
    return None


def delete_sheet(sheet_id: int) -> bool:
    conn = _connect()
    cursor = conn.execute("DELETE FROM sheets WHERE id = ?", (sheet_id,))
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()
    return deleted
