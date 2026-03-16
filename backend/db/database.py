from __future__ import annotations

import json
import sqlite3

from core.config import DB_PATH


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def _migrate(conn: sqlite3.Connection) -> None:
    new_columns = [
        ("name", "TEXT"),
        ("author", "TEXT"),
        ("image_filename", "TEXT"),
        ("duration", "REAL NOT NULL DEFAULT 0"),
    ]
    for col_name, col_type in new_columns:
        try:
            conn.execute(f"ALTER TABLE sheets ADD COLUMN {col_name} {col_type}")
        except sqlite3.OperationalError:
            pass
    conn.commit()


def init_db() -> None:
    conn = _connect()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS sheets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            notes_json TEXT NOT NULL,
            note_count INTEGER NOT NULL DEFAULT 0,
            name TEXT,
            author TEXT,
            image_filename TEXT,
            duration REAL NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """
    )
    conn.commit()
    _migrate(conn)
    conn.close()


def save_sheet(filename: str, notes: list[dict], duration: float = 0) -> int:
    conn = _connect()
    cursor = conn.execute(
        "INSERT INTO sheets (filename, notes_json, note_count, duration) VALUES (?, ?, ?, ?)",
        (filename, json.dumps(notes), len(notes), duration),
    )
    conn.commit()
    sheet_id = cursor.lastrowid
    conn.close()
    return sheet_id  # type: ignore[return-value]


def get_all_sheets() -> list[dict]:
    conn = _connect()
    rows = conn.execute(
        "SELECT id, filename, name, author, image_filename, note_count, duration, created_at "
        "FROM sheets ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_sheet(sheet_id: int) -> dict | None:
    conn = _connect()
    row = conn.execute(
        "SELECT id, filename, name, author, image_filename, note_count, duration, "
        "created_at, notes_json FROM sheets WHERE id = ?",
        (sheet_id,),
    ).fetchone()
    conn.close()
    if not row:
        return None
    data = dict(row)
    data["notes"] = json.loads(data.pop("notes_json"))
    return data


def get_sheet_notes(sheet_id: int) -> list[dict] | None:
    conn = _connect()
    row = conn.execute(
        "SELECT notes_json FROM sheets WHERE id = ?", (sheet_id,)
    ).fetchone()
    conn.close()
    if row:
        return json.loads(row["notes_json"])
    return None


def update_sheet(sheet_id: int, *, name: str | None = None, author: str | None = None) -> bool:
    conn = _connect()
    fields: list[str] = []
    values: list[object] = []
    if name is not None:
        fields.append("name = ?")
        values.append(name)
    if author is not None:
        fields.append("author = ?")
        values.append(author)
    if not fields:
        conn.close()
        return False
    values.append(sheet_id)
    cursor = conn.execute(
        f"UPDATE sheets SET {', '.join(fields)} WHERE id = ?", values
    )
    conn.commit()
    updated = cursor.rowcount > 0
    conn.close()
    return updated


def set_sheet_image(sheet_id: int, image_filename: str) -> bool:
    conn = _connect()
    cursor = conn.execute(
        "UPDATE sheets SET image_filename = ? WHERE id = ?",
        (image_filename, sheet_id),
    )
    conn.commit()
    updated = cursor.rowcount > 0
    conn.close()
    return updated


def delete_sheet(sheet_id: int) -> bool:
    conn = _connect()
    cursor = conn.execute("DELETE FROM sheets WHERE id = ?", (sheet_id,))
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()
    return deleted