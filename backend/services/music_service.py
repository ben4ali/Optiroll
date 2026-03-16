from __future__ import annotations

import muspy

from core.config import DEFAULT_TEMPO_BPM


def parse_score_to_notes(score: muspy.Music) -> list[dict]:
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

    notes.sort(key=lambda note: (note["start"], note["pitch"]))
    return notes


def read_musicxml_notes(musicxml_path: str) -> list[dict]:
    score = muspy.read(musicxml_path)
    return parse_score_to_notes(score)


def compute_duration(notes: list[dict]) -> float:
    if not notes:
        return 0.0
    return max(note["start"] + note["duration"] for note in notes)