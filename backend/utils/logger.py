from __future__ import annotations

import io
import logging
import queue


class QueueLogHandler(logging.Handler):
    def __init__(self, log_queue: queue.Queue[str]) -> None:
        super().__init__()
        self.log_queue = log_queue

    def emit(self, record: logging.LogRecord) -> None:
        self.log_queue.put(self.format(record))


class TeeWriter:
    def __init__(self, original: io.TextIOBase, log_queue: queue.Queue[str]) -> None:
        self.original = original
        self.log_queue = log_queue
        self._buffer = ""

    def write(self, value: str) -> int:
        self.original.write(value)
        self._buffer += value
        while "\n" in self._buffer:
            line, self._buffer = self._buffer.split("\n", 1)
            stripped = line.strip()
            if stripped:
                self.log_queue.put(stripped)
        return len(value)

    def flush(self) -> None:
        if self._buffer.strip():
            self.log_queue.put(self._buffer.strip())
            self._buffer = ""
        self.original.flush()

    def __getattr__(self, name: str):  # type: ignore[override]
        return getattr(self.original, name)