import type { ColorScheme } from '@/lib/colors';
import { DEFAULT_COLOR_SCHEME, getDimColors } from '@/lib/colors';
import type { HitEffect, NoteData } from '@/lib/types';
import {
  type Particle,
  type Ripple,
  spawnParticles,
  spawnRipple,
  updateParticles,
  updateRipples,
} from '@/lib/particles';
import { useEffect, useMemo, useRef } from 'react';

// MIDI range: 21 (A0) through 108 (C8) = 88 keys
const MIN_PITCH = 21;
const MAX_PITCH = 108;
const PITCH_RANGE = MAX_PITCH - MIN_PITCH + 1;

const VISIBLE_SECONDS = 6;
const KEYBOARD_HEIGHT = 80;

const BLACK_KEY_CLASSES = new Set([1, 3, 6, 8, 10]);

interface PianoRollProps {
  notes: NoteData[];
  currentTime: number;
  playing: boolean;
  colorScheme?: ColorScheme;
  hitEffect?: HitEffect;
  particleIntensity?: number;
}

export function PianoRoll({
  notes,
  currentTime,
  playing,
  colorScheme = DEFAULT_COLOR_SCHEME,
  hitEffect = 'glow',
  particleIntensity = 2,
}: PianoRollProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentTimeRef = useRef(currentTime);
  const playingRef = useRef(playing);
  const rafRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0 });

  // Particle / ripple pools
  const particlePoolRef = useRef<Particle[]>([]);
  const ripplePoolRef = useRef<Ripple[]>([]);
  const spawnedRef = useRef<Set<number>>(new Set());
  const prevDrawTimeRef = useRef(0);

  currentTimeRef.current = currentTime;
  playingRef.current = playing;

  const colorSchemeRef = useRef(colorScheme);
  const hitEffectRef = useRef(hitEffect);
  const particleIntensityRef = useRef(particleIntensity);
  colorSchemeRef.current = colorScheme;
  hitEffectRef.current = hitEffect;
  particleIntensityRef.current = particleIntensity;

  // Sort notes once for binary search
  const sorted = useMemo(() => {
    return notes
      .filter(n => n.pitch >= MIN_PITCH && n.pitch <= MAX_PITCH)
      .slice()
      .sort((a, b) => a.start - b.start);
  }, [notes]);
  const sortedRef = useRef(sorted);
  sortedRef.current = sorted;

  // Reset on note change
  useEffect(() => {
    spawnedRef.current.clear();
    particlePoolRef.current.length = 0;
    ripplePoolRef.current.length = 0;
    prevDrawTimeRef.current = 0;
  }, [sorted]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

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

      // Detect rewind — reset effects
      if (t < prevDrawTimeRef.current - 0.5) {
        spawnedRef.current.clear();
        particlePoolRef.current.length = 0;
        ripplePoolRef.current.length = 0;
      }
      prevDrawTimeRef.current = t;

      const kbY = h - KEYBOARD_HEIGHT;
      const hitLineY = kbY;
      const pxPerSecond = hitLineY / VISIBLE_SECONDS;

      const scheme = colorSchemeRef.current;
      const colors = scheme.colors;
      const dimColors = getDimColors(scheme);
      const effect = hitEffectRef.current;

      // Background — dark purple-blue
      ctx.fillStyle = '#0c0a1a';
      ctx.fillRect(0, 0, w, h);

      // Grid lines
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

      // Binary search for visible window
      const visibleStart = t - 0.5;
      const visibleEnd = t + VISIBLE_SECONDS + 0.5;
      const arr = sortedRef.current;

      let lo = 0;
      let hi = arr.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (arr[mid].start + arr[mid].duration < visibleStart) lo = mid + 1;
        else hi = mid;
      }

      const activePitches = new Uint8Array(128);

      // Clip to rolling area
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, hitLineY);
      ctx.clip();

      // Draw falling notes
      for (let i = lo; i < arr.length; i++) {
        const note = arr[i];
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
          ctx.fillStyle = colors[pc];

          // Spawn effects on note onset
          if (!spawnedRef.current.has(i)) {
            spawnedRef.current.add(i);
            const cx = x + colWidth / 2;
            if (effect === 'particles') {
              spawnParticles(
                particlePoolRef.current,
                cx,
                hitLineY,
                colors[pc],
                particleIntensityRef.current,
              );
            } else if (effect === 'ripple') {
              spawnRipple(ripplePoolRef.current, cx, hitLineY, colors[pc]);
            }
          }
        } else {
          ctx.fillStyle = dimColors[pc];
        }

        const radius = Math.min(4, barWidth / 2);
        ctx.beginPath();
        ctx.roundRect(x + 1, noteBotY, barWidth, barHeight, radius);
        ctx.fill();
      }

      ctx.restore(); // remove clip

      // ── Piano keyboard ──
      const kbH = KEYBOARD_HEIGHT;
      const blackKeyH = kbH * 0.6;

      ctx.fillStyle = '#0f0d1e';
      ctx.fillRect(0, kbY, w, kbH);

      for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
        if (BLACK_KEY_CLASSES.has(p % 12)) continue;
        const x = (p - MIN_PITCH) * colWidth;
        const ap = activePitches[p];
        ctx.fillStyle = ap ? colors[ap - 1] : '#e8e8e8';
        ctx.fillRect(x + 0.5, kbY, colWidth - 1, kbH - 1);
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 0.5, kbY, colWidth - 1, kbH - 1);
      }

      for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
        if (!BLACK_KEY_CLASSES.has(p % 12)) continue;
        const x = (p - MIN_PITCH) * colWidth;
        const bw = colWidth * 0.7;
        const bx = x + (colWidth - bw) / 2;
        const ap = activePitches[p];
        ctx.fillStyle = ap ? colors[ap - 1] : '#1a1628';
        ctx.fillRect(bx, kbY, bw, blackKeyH);
        ctx.strokeStyle = ap ? 'rgba(255,255,255,0.3)' : '#333';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(bx, kbY, bw, blackKeyH);
      }

      ctx.font = '9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
        if (p % 12 !== 0) continue;
        const x = (p - MIN_PITCH) * colWidth + colWidth / 2;
        const octave = Math.floor(p / 12) - 1;
        ctx.fillStyle = activePitches[p]
          ? 'rgba(0,0,0,0.7)'
          : 'rgba(0,0,0,0.4)';
        ctx.fillText(`C${octave}`, x, kbY + kbH - 6);
      }

      // ── Hit effects (drawn AFTER keyboard using shadowBlur for reliable glow) ──
      ctx.globalCompositeOperation = 'source-over';

      if (effect === 'glow' || effect === 'none') {
        // Glow: draw bright rectangles with shadowBlur for bloom
        if (effect === 'glow') {
          ctx.save();
          ctx.shadowBlur = 25;
          for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
            if (!activePitches[p]) continue;
            const color = colors[activePitches[p] - 1];
            const x = (p - MIN_PITCH) * colWidth;
            ctx.shadowColor = color;
            ctx.fillStyle = color;
            ctx.fillRect(x, hitLineY - 6, colWidth, 6);
          }
          ctx.restore();
        }
      }

      if (effect === 'particles') {
        // Particles: draw with shadowBlur for glow around each particle
        updateParticles(particlePoolRef.current);
        if (particlePoolRef.current.length > 0) {
          ctx.save();
          ctx.shadowBlur = 8;
          for (const p of particlePoolRef.current) {
            const alpha = Math.min(1, (p.life / p.maxLife) * 1.4);
            const col = `rgba(${p.r},${p.g},${p.b},${alpha.toFixed(3)})`;
            ctx.shadowColor = `rgb(${p.r},${p.g},${p.b})`;
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      if (effect === 'ripple') {
        // Ripples: expanding rings with shadowBlur
        updateRipples(ripplePoolRef.current);
        if (ripplePoolRef.current.length > 0) {
          ctx.save();
          ctx.shadowBlur = 10;
          for (const r of ripplePoolRef.current) {
            const alpha = (r.life / r.maxLife) * 0.8;
            const col = `rgba(${r.r},${r.g},${r.b},${alpha.toFixed(3)})`;
            ctx.shadowColor = `rgb(${r.r},${r.g},${r.b})`;
            ctx.strokeStyle = col;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        }
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
      style={{ background: '#0c0a1a' }}
    />
  );
}
