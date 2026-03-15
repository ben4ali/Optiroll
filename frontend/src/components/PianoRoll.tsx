import type { ColorScheme } from '@/lib/colors';
import { DEFAULT_COLOR_SCHEME } from '@/lib/colors';
import {
  type Particle,
  type Ripple,
  spawnParticles,
  spawnRipple,
  updateParticles,
  updateRipples,
} from '@/lib/particles';
import type { HitEffect, NoteData } from '@/lib/types';
import { useEffect, useMemo, useRef } from 'react';

// MIDI range: 21 (A0) through 108 (C8) = 88 keys
const MIN_PITCH = 21;
const MAX_PITCH = 108;
const PITCH_RANGE = MAX_PITCH - MIN_PITCH + 1;

const VISIBLE_SECONDS = 6;
const KEYBOARD_HEIGHT = 120;

// Pre-compute which pitches are black keys (static lookup)
const IS_BLACK = new Uint8Array(128);
for (let p = 0; p < 128; p++) {
  const cls = p % 12;
  IS_BLACK[p] =
    cls === 1 || cls === 3 || cls === 6 || cls === 8 || cls === 10 ? 1 : 0;
}

// Reusable typed array for active-pitch tracking (avoids allocation per frame)
const _activePitches = new Uint8Array(128);

interface PianoRollProps {
  notes: NoteData[];
  currentTime: number;
  playing: boolean;
  colorScheme?: ColorScheme;
  hitEffect?: HitEffect;
  particleIntensity?: number;
}

// ── Pre-computed color cache ──
interface ColorCache {
  key: string;
  colors: readonly string[];
  dimColors: string[];
  rgbColors: [number, number, number][];
}

function buildColorCache(scheme: ColorScheme): ColorCache {
  const rgbColors: [number, number, number][] = scheme.colors.map(hex => {
    const v = parseInt(hex.slice(1, 7), 16);
    return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
  });
  return {
    key: scheme.value,
    colors: scheme.colors,
    dimColors: scheme.colors.map(c => c + 'cc'),
    rgbColors,
  };
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
  const rafRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0 });
  const drawRef = useRef<() => void>(() => {});

  // ── Mutable refs for props (read inside draw without re-creating effect) ──
  const currentTimeRef = useRef(currentTime);
  const playingRef = useRef(playing);
  const hitEffectRef = useRef(hitEffect);
  const particleIntensityRef = useRef(particleIntensity);
  currentTimeRef.current = currentTime;
  playingRef.current = playing;
  hitEffectRef.current = hitEffect;
  particleIntensityRef.current = particleIntensity;

  // Particle / ripple pools
  const particlePoolRef = useRef<Particle[]>([]);
  const ripplePoolRef = useRef<Ripple[]>([]);
  const spawnedRef = useRef<Set<number>>(new Set());
  const prevDrawTimeRef = useRef(0);

  // Color cache — rebuilt only when scheme identity changes
  const colorCacheRef = useRef<ColorCache>(buildColorCache(colorScheme));
  if (colorCacheRef.current.key !== colorScheme.value) {
    colorCacheRef.current = buildColorCache(colorScheme);
  }

  // Sort notes once for binary search
  const sorted = useMemo(() => {
    return notes
      .filter(n => n.pitch >= MIN_PITCH && n.pitch <= MAX_PITCH)
      .slice()
      .sort((a, b) => a.start - b.start);
  }, [notes]);
  const sortedRef = useRef(sorted);
  sortedRef.current = sorted;

  // Pre-compute end times in a Float64Array (avoids addition in hot loop)
  const endTimes = useMemo(() => {
    return new Float64Array(sorted.map(n => n.start + n.duration));
  }, [sorted]);
  const endTimesRef = useRef(endTimes);
  endTimesRef.current = endTimes;

  // Reset effects on note change
  useEffect(() => {
    spawnedRef.current.clear();
    particlePoolRef.current.length = 0;
    ripplePoolRef.current.length = 0;
    prevDrawTimeRef.current = 0;
  }, [sorted]);

  // Glare phase — animated continuously
  const glarePhaseRef = useRef(0);

  // ── Main draw loop setup — only re-created when sorted notes change ──
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

    const ro = new ResizeObserver(() => {
      syncSize();
      // Redraw static frame on resize while paused
      if (!playingRef.current) drawRef.current();
    });
    ro.observe(canvas);
    syncSize();

    // Pre-cached grid line x-positions
    let cachedGridW = 0;
    let gridXs: number[] = [];

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

      // Advance glare animation phase
      glarePhaseRef.current = (glarePhaseRef.current + 0.008) % 1;
      const glarePhase = glarePhaseRef.current;

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

      const cc = colorCacheRef.current;
      const colors = cc.colors;
      const dimColors = cc.dimColors;
      const rgbColors = cc.rgbColors;
      const effect = hitEffectRef.current;

      // ── Background ──
      ctx.fillStyle = '#0c0e1f';
      ctx.fillRect(0, 0, w, h);

      // ── Grid lines — batched single path ──
      if (w !== cachedGridW) {
        cachedGridW = w;
        gridXs = [];
        for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
          if (IS_BLACK[p]) continue;
          gridXs.push((p - MIN_PITCH) * colWidth);
        }
      }
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let g = 0; g < gridXs.length; g++) {
        ctx.moveTo(gridXs[g], 0);
        ctx.lineTo(gridXs[g], hitLineY);
      }
      ctx.stroke();

      // ── Hit line ──
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.moveTo(0, hitLineY);
      ctx.lineTo(w, hitLineY);
      ctx.stroke();

      // ── Binary search for visible window ──
      const visibleStart = t - 0.5;
      const visibleEnd = t + VISIBLE_SECONDS + 0.5;
      const arr = sortedRef.current;
      const ends = endTimesRef.current;
      const arrLen = arr.length;

      let lo = 0;
      let hi = arrLen;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (ends[mid] < visibleStart) lo = mid + 1;
        else hi = mid;
      }

      // Reset active pitches (zero-fill is very fast on typed arrays)
      _activePitches.fill(0);

      // Clip to rolling area
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, hitLineY);
      ctx.clip();

      // ── Draw falling notes (glassmorphism bars) ──
      const radius = Math.min(4, (colWidth - 2) / 2);
      const useRoundRect = colWidth >= 8;

      for (let i = lo; i < arrLen; i++) {
        const note = arr[i];
        if (note.start > visibleEnd) break;

        const end = ends[i];
        const noteTopTime = note.start - t;
        const noteBotTime = end - t;
        const noteTopY = hitLineY - noteTopTime * pxPerSecond;
        const noteBotY = hitLineY - noteBotTime * pxPerSecond;

        if (noteTopY < -20 || noteBotY > hitLineY + 20) continue;

        const x = (note.pitch - MIN_PITCH) * colWidth;
        const barX = x + 1;
        const barWidth = colWidth - 2;
        const barHeight = noteTopY - noteBotY;
        const pc = note.pitch % 12;
        const active = t >= note.start && t < end;
        const [r, g, b] = rgbColors[pc];

        if (active) {
          _activePitches[note.pitch] = pc + 1;

          // Spawn effects on note onset
          if (!spawnedRef.current.has(i)) {
            spawnedRef.current.add(i);
            if (effect === 'particles') {
              spawnParticles(
                particlePoolRef.current,
                x + colWidth / 2,
                hitLineY,
                colors[pc],
                particleIntensityRef.current,
              );
            } else if (effect === 'ripple') {
              spawnRipple(
                ripplePoolRef.current,
                x + colWidth / 2,
                hitLineY,
                colors[pc],
              );
            }
          }
        }

        // ── Glass bar fill — full opacity always ──
        ctx.fillStyle = colors[pc];
        if (!useRoundRect || barHeight < 8) {
          ctx.fillRect(barX, noteBotY, barWidth, barHeight);
        } else {
          ctx.beginPath();
          ctx.roundRect(barX, noteBotY, barWidth, barHeight, radius);
          ctx.fill();
        }

        // ── Brightness boost when active (additive white overlay) ──
        if (active) {
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          if (!useRoundRect || barHeight < 8) {
            ctx.fillRect(barX, noteBotY, barWidth, barHeight);
          } else {
            ctx.beginPath();
            ctx.roundRect(barX, noteBotY, barWidth, barHeight, radius);
            ctx.fill();
          }
        }

        // ── Brighter left edge (light hitting the glass) ──
        ctx.fillStyle = `rgba(255,255,255,${active ? 0.3 : 0.15})`;
        ctx.fillRect(barX, noteBotY, 1.5, barHeight);

        // ── Top edge highlight ──
        ctx.fillStyle = `rgba(255,255,255,${active ? 0.2 : 0.08})`;
        ctx.fillRect(barX, noteBotY, barWidth, 1.5);

        // ── Diagonal glare sweep ──
        if (barHeight > 12 && barWidth > 4) {
          const phase = (glarePhase + i * 0.037) % 1;
          // The glare band travels diagonally from bottom-left to top-right
          const travelRange = barHeight + barWidth;
          const glarePos = phase * travelRange;
          const bandW = Math.min(barWidth * 0.5, 14);

          ctx.save();
          ctx.beginPath();
          if (useRoundRect) {
            ctx.roundRect(barX, noteBotY, barWidth, barHeight, radius);
          } else {
            ctx.rect(barX, noteBotY, barWidth, barHeight);
          }
          ctx.clip();

          // Draw a diagonal band: rotated ~30deg rectangle
          const cx = barX + glarePos - barHeight * 0.3;
          const cy = noteBotY + barHeight - glarePos * 0.6;
          ctx.translate(cx, cy);
          ctx.rotate(-0.55);
          const grd = ctx.createLinearGradient(0, 0, bandW, 0);
          grd.addColorStop(0, 'rgba(255,255,255,0)');
          grd.addColorStop(0.5, `rgba(255,255,255,${active ? 0.22 : 0.09})`);
          grd.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = grd;
          ctx.fillRect(0, -barHeight * 2, bandW, barHeight * 4);
          ctx.restore();
        }

        // ── Thin right edge for depth ──
        ctx.fillStyle = `rgba(255,255,255,${active ? 0.1 : 0.05})`;
        ctx.fillRect(barX + barWidth - 1, noteBotY, 1, barHeight);
      }

      ctx.restore(); // remove clip

      // ── Piano keyboard ──
      const kbH = KEYBOARD_HEIGHT;
      const blackKeyH = kbH * 0.6;

      ctx.fillStyle = '#0d0f20';
      ctx.fillRect(0, kbY, w, kbH);

      // White keys (fills)
      for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
        if (IS_BLACK[p]) continue;
        const kx = (p - MIN_PITCH) * colWidth;
        const ap = _activePitches[p];
        ctx.fillStyle = ap ? colors[ap - 1] : '#e8e8e8';
        ctx.fillRect(kx + 0.5, kbY, colWidth - 1, kbH - 1);
      }

      // White key borders — batched single stroke
      ctx.beginPath();
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 0.5;
      for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
        if (IS_BLACK[p]) continue;
        const kx = (p - MIN_PITCH) * colWidth;
        ctx.rect(kx + 0.5, kbY, colWidth - 1, kbH - 1);
      }
      ctx.stroke();

      // Black keys (fills)
      for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
        if (!IS_BLACK[p]) continue;
        const kx = (p - MIN_PITCH) * colWidth;
        const bw = colWidth * 0.7;
        const bx = kx + (colWidth - bw) / 2;
        const ap = _activePitches[p];
        ctx.fillStyle = ap ? colors[ap - 1] : '#1a1628';
        ctx.fillRect(bx, kbY, bw, blackKeyH);
      }

      // Black key borders — batched
      ctx.beginPath();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 0.5;
      for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
        if (!IS_BLACK[p]) continue;
        const bw = colWidth * 0.7;
        const bx = (p - MIN_PITCH) * colWidth + (colWidth - bw) / 2;
        ctx.rect(bx, kbY, bw, blackKeyH);
      }
      ctx.stroke();

      // Active black key highlight borders
      for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
        if (!IS_BLACK[p] || !_activePitches[p]) continue;
        const bw = colWidth * 0.7;
        const bx = (p - MIN_PITCH) * colWidth + (colWidth - bw) / 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.strokeRect(bx, kbY, bw, blackKeyH);
      }

      // C labels
      ctx.font = '9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
        if (p % 12 !== 0) continue;
        const kx = (p - MIN_PITCH) * colWidth + colWidth / 2;
        const octave = Math.floor(p / 12) - 1;
        ctx.fillStyle = _activePitches[p]
          ? 'rgba(0,0,0,0.7)'
          : 'rgba(0,0,0,0.4)';
        ctx.fillText(`C${octave}`, kx, kbY + kbH - 6);
      }

      // ── Hit effects — NO shadowBlur (massively expensive). Use additive blending. ──

      if (effect === 'glow') {
        ctx.globalCompositeOperation = 'lighter';
        for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
          if (!_activePitches[p]) continue;
          const [cr, cg, cb] = rgbColors[_activePitches[p] - 1];
          const gx = (p - MIN_PITCH) * colWidth;
          // Bright inner glow
          ctx.fillStyle = `rgba(${cr},${cg},${cb},0.6)`;
          ctx.fillRect(gx, hitLineY - 5, colWidth, 5);
          // Softer outer bloom
          ctx.fillStyle = `rgba(${cr},${cg},${cb},0.15)`;
          ctx.fillRect(gx - 4, hitLineY - 18, colWidth + 8, 18);
        }
        ctx.globalCompositeOperation = 'source-over';
      }

      if (effect === 'particles') {
        updateParticles(particlePoolRef.current);
        const pool = particlePoolRef.current;
        if (pool.length > 0) {
          ctx.globalCompositeOperation = 'lighter';
          for (let j = 0; j < pool.length; j++) {
            const pt = pool[j];
            const pa = Math.min(1, (pt.life / pt.maxLife) * 1.4);
            ctx.fillStyle = `rgba(${pt.r},${pt.g},${pt.b},${pa.toFixed(2)})`;
            // Use fillRect instead of arc for particles (much faster, no beginPath/arc)
            const s = pt.size;
            ctx.fillRect(pt.x - s, pt.y - s, s * 2, s * 2);
          }
          ctx.globalCompositeOperation = 'source-over';
        }
      }

      if (effect === 'ripple') {
        updateRipples(ripplePoolRef.current);
        const pool = ripplePoolRef.current;
        if (pool.length > 0) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.lineWidth = 2;
          for (let j = 0; j < pool.length; j++) {
            const rp = pool[j];
            const ra = (rp.life / rp.maxLife) * 0.7;
            ctx.strokeStyle = `rgba(${rp.r},${rp.g},${rp.b},${ra.toFixed(2)})`;
            ctx.beginPath();
            ctx.arc(rp.x, rp.y, rp.radius, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.globalCompositeOperation = 'source-over';
        }
      }

      if (playingRef.current) {
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    // Store draw in ref so external effects can trigger it
    drawRef.current = draw;

    // Initial draw
    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted]);

  // When playing toggles on, kick the rAF loop
  useEffect(() => {
    if (playing) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(drawRef.current);
    }
  }, [playing]);

  // Redraw static frame when paused and currentTime changes (scrubbing)
  useEffect(() => {
    if (!playing) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => drawRef.current());
    }
  }, [playing, currentTime]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block rounded-lg"
      style={{ background: '#0c0e1f' }}
    />
  );
}
