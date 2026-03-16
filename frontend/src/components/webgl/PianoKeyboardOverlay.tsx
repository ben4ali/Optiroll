import type { ColorScheme } from '@/lib/colors';
import { useEffect, useRef } from 'react';
import { IS_BLACK, MAX_PITCH, MIN_PITCH, PITCH_RANGE } from './constants';

interface PianoKeyboardOverlayProps {
  activePitches: Uint8Array;
  colorScheme: ColorScheme;
  height: number; // px height of the keyboard area
  showKeyDividers: boolean;
}

// Parse hex to [r,g,b] tuple
function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1, 7), 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

export function PianoKeyboardOverlay({
  activePitches,
  colorScheme,
  height,
  showKeyDividers,
}: PianoKeyboardOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const activePitchesRef = useRef(activePitches);
  activePitchesRef.current = activePitches;

  const colorsRef = useRef(colorScheme.colors);
  colorsRef.current = colorScheme.colors;

  const showKeyDividersRef = useRef(showKeyDividers);
  showKeyDividersRef.current = showKeyDividers;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const syncSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const pw = Math.round(rect.width * dpr);
      const ph = Math.round(rect.height * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      return { dpr, w: rect.width, h: rect.height };
    };

    const draw = () => {
      const { dpr, w, h } = syncSize();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const ap = activePitchesRef.current;
      const colors = colorsRef.current;
      const colWidth = w / PITCH_RANGE;
      const kbH = h;
      const blackKeyH = kbH * 0.6;
      const glowH = 24; // height of glow zone at top of keyboard

      // Background
      ctx.fillStyle = '#0d0f20';
      ctx.fillRect(0, 0, w, kbH);

      // ── Glow behind keys (always on, boosted for active keys) ──
      const prevOp = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.003);
      for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
        const pcIndex = p % 12;
        const activePc = ap[p];
        const [r, g, b] = hexToRgb(colors[pcIndex]);
        const kx = (p - MIN_PITCH) * colWidth + colWidth / 2;

        const baseGlow = 0.28;
        const boost = activePc ? 0.55 * pulse : 0;
        const intensity = baseGlow + boost;

        // Upward glow gradient from top of key
        const grad = ctx.createLinearGradient(kx, glowH, kx, 0);
        grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
        grad.addColorStop(
          0.3,
          `rgba(${r},${g},${b},${(0.35 * intensity).toFixed(3)})`,
        );
        grad.addColorStop(
          1,
          `rgba(${r},${g},${b},${(0.7 * intensity).toFixed(3)})`,
        );
        ctx.fillStyle = grad;
        ctx.fillRect(kx - colWidth * 1.2, 0, colWidth * 2.4, glowH);

        // Core bright spot at very top
        const coreGrad = ctx.createRadialGradient(
          kx,
          0,
          0,
          kx,
          0,
          colWidth * 1.5,
        );
        coreGrad.addColorStop(
          0,
          `rgba(${r},${g},${b},${(0.9 * intensity).toFixed(3)})`,
        );
        coreGrad.addColorStop(
          0.5,
          `rgba(${r},${g},${b},${(0.35 * intensity).toFixed(3)})`,
        );
        coreGrad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = coreGrad;
        ctx.fillRect(kx - colWidth * 2, 0, colWidth * 4, glowH * 0.6);
      }
      ctx.globalCompositeOperation = prevOp;

      // ── White keys ──
      for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
        if (IS_BLACK[p]) continue;
        const kx = (p - MIN_PITCH) * colWidth;
        const pc = ap[p];
        const pcIndex = p % 12;
        const [gr, gg, gb] = hexToRgb(colors[pcIndex]);
        const glowAlpha = pc ? 0.35 : 0.18;
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = `rgba(${gr},${gg},${gb},${glowAlpha})`;
        ctx.fillStyle = `rgba(${gr},${gg},${gb},${glowAlpha})`;
        ctx.fillRect(kx - 0.5, -0.5, colWidth + 1, kbH);
        ctx.restore();
        if (pc) {
          // Active: colored with a slight gradient for depth
          const hex = colors[pc - 1];
          const [r, g, b] = hexToRgb(hex);
          const grad = ctx.createLinearGradient(kx, 0, kx, kbH);
          grad.addColorStop(
            0,
            `rgb(${Math.min(255, r + 60)},${Math.min(255, g + 60)},${Math.min(255, b + 60)})`,
          );
          grad.addColorStop(1, hex);
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = '#e8e8e8';
        }
        ctx.fillRect(kx + 0.5, 0, colWidth - 1, kbH - 1);
      }

      if (showKeyDividersRef.current) {
        // White key borders
        ctx.beginPath();
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 0.5;
        for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
          if (IS_BLACK[p]) continue;
          const kx = (p - MIN_PITCH) * colWidth;
          ctx.rect(kx + 0.5, 0, colWidth - 1, kbH - 1);
        }
        ctx.stroke();
      }

      // ── Black keys ──
      for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
        if (!IS_BLACK[p]) continue;
        const kx = (p - MIN_PITCH) * colWidth;
        const bw = colWidth * 0.7;
        const bx = kx + (colWidth - bw) / 2;
        const pc = ap[p];
        const pcIndex = p % 12;
        const [gr, gg, gb] = hexToRgb(colors[pcIndex]);
        const glowAlpha = pc ? 0.4 : 0.22;
        ctx.save();
        ctx.shadowBlur = 12;
        ctx.shadowColor = `rgba(${gr},${gg},${gb},${glowAlpha})`;
        ctx.fillStyle = `rgba(${gr},${gg},${gb},${glowAlpha})`;
        ctx.fillRect(bx - 1, -1, bw + 2, blackKeyH + 2);
        ctx.restore();
        if (pc) {
          const hex = colors[pc - 1];
          const [r, g, b] = hexToRgb(hex);
          const grad = ctx.createLinearGradient(bx, 0, bx, blackKeyH);
          grad.addColorStop(
            0,
            `rgb(${Math.min(255, r + 40)},${Math.min(255, g + 40)},${Math.min(255, b + 40)})`,
          );
          grad.addColorStop(1, hex);
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = '#1a1628';
        }
        ctx.fillRect(bx, 0, bw, blackKeyH);
      }

      if (showKeyDividersRef.current) {
        // Black key borders
        ctx.beginPath();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.5;
        for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
          if (!IS_BLACK[p]) continue;
          const bw = colWidth * 0.7;
          const bx = (p - MIN_PITCH) * colWidth + (colWidth - bw) / 2;
          ctx.rect(bx, 0, bw, blackKeyH);
        }
        ctx.stroke();
      }

      // Active black key glow border
      for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
        if (!IS_BLACK[p] || !ap[p]) continue;
        const bw = colWidth * 0.7;
        const bx = (p - MIN_PITCH) * colWidth + (colWidth - bw) / 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, 0, bw, blackKeyH);
      }

      // C labels
      ctx.font = '9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
        if (p % 12 !== 0) continue;
        const kx = (p - MIN_PITCH) * colWidth + colWidth / 2;
        const octave = Math.floor(p / 12) - 1;
        ctx.fillStyle = ap[p] ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)';
        ctx.fillText(`C${octave}`, kx, kbH - 6);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    const ro = new ResizeObserver(() => syncSize());
    ro.observe(canvas);

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full block"
      style={{
        height: `${height}px`,
        background: '#0d0f20',
      }}
    />
  );
}
