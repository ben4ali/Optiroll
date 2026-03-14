import type { NoteData } from '@/lib/types';
import { useEffect, useMemo, useRef } from 'react';

// MIDI range: 21 (A0) through 108 (C8) = 88 keys
const MIN_PITCH = 21;
const MAX_PITCH = 108;
const PITCH_RANGE = MAX_PITCH - MIN_PITCH + 1;

const VISIBLE_SECONDS = 6;
const KEYBOARD_HEIGHT = 80;

const BLACK_KEY_CLASSES = new Set([1, 3, 6, 8, 10]);

const BAR_COLORS = [
  '#f87171', '#fb923c', '#fbbf24', '#facc15',
  '#a3e635', '#4ade80', '#34d399', '#22d3ee',
  '#60a5fa', '#818cf8', '#a78bfa', '#c084fc',
];

// Pre-compute translucent versions
const BAR_COLORS_DIM = BAR_COLORS.map(c => c + 'cc');

interface PianoRollProps {
  notes: NoteData[];
  currentTime: number;
  playing: boolean;
}

export function PianoRoll({ notes, currentTime, playing }: PianoRollProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentTimeRef = useRef(currentTime);
  const playingRef = useRef(playing);
  const rafRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0 });

  currentTimeRef.current = currentTime;
  playingRef.current = playing;

  // Sort notes by start time once, for binary search
  const sorted = useMemo(() => {
    const arr = notes
      .filter(n => n.pitch >= MIN_PITCH && n.pitch <= MAX_PITCH)
      .slice()
      .sort((a, b) => a.start - b.start);
    return arr;
  }, [notes]);
  const sortedRef = useRef(sorted);
  sortedRef.current = sorted;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Resize only when dimensions change
    const syncSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const pw = Math.round(rect.width * dpr);
      const ph = Math.round(rect.height * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
        sizeRef.current = { w: rect.width, h: rect.height };
      }
      return dpr;
    };

    const ro = new ResizeObserver(() => syncSize());
    ro.observe(canvas);
    syncSize();

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      syncSize();
      const { w, h } = sizeRef.current;
      if (w === 0 || h === 0) {
        if (playingRef.current) rafRef.current = requestAnimationFrame(draw);
        return;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const t = currentTimeRef.current;
      const colWidth = w / PITCH_RANGE;
      const kbY = h - KEYBOARD_HEIGHT;
      const hitLineY = kbY;
      const pxPerSecond = hitLineY / VISIBLE_SECONDS;

      // Background
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, w, h);

      // Grid lines — batch into one path
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
        if (BLACK_KEY_CLASSES.has(p % 12)) continue;
        const x = (p - MIN_PITCH) * colWidth;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, hitLineY);
      }
      ctx.stroke();

      // Hit line
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.moveTo(0, hitLineY);
      ctx.lineTo(w, hitLineY);
      ctx.stroke();

      // ── Binary search for visible time window ──
      const visibleStart = t - 0.5; // small buffer for notes ending just now
      const visibleEnd = t + VISIBLE_SECONDS + 0.5;
      const arr = sortedRef.current;

      // Find first note that could be visible:
      // note.start + note.duration >= visibleStart
      // We search for the first note where start >= visibleStart - maxDuration
      // Conservative: start from binary search on visibleStart - generous buffer
      let lo = 0;
      let hi = arr.length;
      const searchTime = visibleStart - 30; // 30s max note duration buffer
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (arr[mid].start + arr[mid].duration < visibleStart) lo = mid + 1;
        else hi = mid;
      }

      const activePitches = new Uint8Array(128); // 0 = inactive, pitch class + 1 for color

      // Clip to rolling area
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, hitLineY);
      ctx.clip();

      // Draw notes — only iterate the visible window
      for (let i = lo; i < arr.length; i++) {
        const note = arr[i];
        // If the note starts after visible window, stop
        if (note.start > visibleEnd) break;

        const noteTopTime = note.start - t;
        const noteBotTime = note.start + note.duration - t;

        const noteTopY = hitLineY - noteTopTime * pxPerSecond;
        const noteBotY = hitLineY - noteBotTime * pxPerSecond;

        if (noteTopY < -20 || noteBotY > hitLineY + 20) continue;

        const x = (note.pitch - MIN_PITCH) * colWidth;
        const barWidth = colWidth - 2;
        const barHeight = noteTopY - noteBotY;
        const pc = note.pitch % 12;

        const active = t >= note.start && t < note.start + note.duration;

        if (active) {
          activePitches[note.pitch] = pc + 1;
          ctx.fillStyle = BAR_COLORS[pc];
        } else {
          ctx.fillStyle = BAR_COLORS_DIM[pc];
        }

        const radius = Math.min(4, barWidth / 2);
        ctx.beginPath();
        ctx.roundRect(x + 1, noteBotY, barWidth, barHeight, radius);
        ctx.fill();
      }

      ctx.restore(); // remove clip

      // ── Glow pass (only active notes, drawn as blurred rects below hit line) ──
      for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
        if (!activePitches[p]) continue;
        const pc = activePitches[p] - 1;
        const x = (p - MIN_PITCH) * colWidth;
        ctx.fillStyle = BAR_COLORS[pc] + '40';
        ctx.fillRect(x - 4, hitLineY - 12, colWidth + 8, 12);
      }

      // ── Piano keyboard ──
      const kbH = KEYBOARD_HEIGHT;
      const blackKeyH = kbH * 0.6;

      ctx.fillStyle = '#111118';
      ctx.fillRect(0, kbY, w, kbH);

      // White keys
      for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
        if (BLACK_KEY_CLASSES.has(p % 12)) continue;
        const x = (p - MIN_PITCH) * colWidth;
        const ap = activePitches[p];
        ctx.fillStyle = ap ? BAR_COLORS[ap - 1] : '#e8e8e8';
        ctx.fillRect(x + 0.5, kbY, colWidth - 1, kbH - 1);
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 0.5, kbY, colWidth - 1, kbH - 1);
      }

      // Black keys
      for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
        if (!BLACK_KEY_CLASSES.has(p % 12)) continue;
        const x = (p - MIN_PITCH) * colWidth;
        const bw = colWidth * 0.7;
        const bx = x + (colWidth - bw) / 2;
        const ap = activePitches[p];
        ctx.fillStyle = ap ? BAR_COLORS[ap - 1] : '#1a1a24';
        ctx.fillRect(bx, kbY, bw, blackKeyH);
        ctx.strokeStyle = ap ? 'rgba(255,255,255,0.3)' : '#333';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(bx, kbY, bw, blackKeyH);
      }

      // Octave labels
      ctx.font = '9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
        if (p % 12 !== 0) continue;
        const x = (p - MIN_PITCH) * colWidth + colWidth / 2;
        const octave = Math.floor(p / 12) - 1;
        ctx.fillStyle = activePitches[p] ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)';
        ctx.fillText(`C${octave}`, x, kbY + kbH - 6);
      }

      if (playingRef.current) {
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    draw();
    if (playing) {
      rafRef.current = requestAnimationFrame(draw);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [playing, currentTime, sorted]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block rounded-lg"
      style={{ background: '#0a0a0f' }}
    />
  );
}
