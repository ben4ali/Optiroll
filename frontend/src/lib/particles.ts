// Custom particle + ripple system for piano roll hit effects.
// Designed to run inside the existing canvas RAF draw loop.

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  r: number;
  g: number;
  b: number;
  size: number;
}

export interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  r: number;
  g: number;
  b: number;
}

/** Parse hex color to RGB tuple. */
function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1, 7), 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

/**
 * Spawn a burst of particles at (x, y) for a note onset.
 * @param intensity 1 = low, 2 = medium, 3 = high
 */
export function spawnParticles(
  pool: Particle[],
  x: number,
  y: number,
  color: string,
  intensity: number = 2,
): void {
  const counts = [6, 12, 22];
  const count =
    counts[Math.min(intensity, 3) - 1] + Math.floor(Math.random() * 4);
  const [r, g, b] = hexToRgb(color);
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
    const speed = 1.2 + Math.random() * 2.5 * intensity * 0.6;
    const life = 30 + Math.floor(Math.random() * 25);
    pool.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      maxLife: life,
      r,
      g,
      b,
      size: 2 + Math.random() * 3,
    });
  }
}

/** Update all particles in-place, removing dead ones. */
export function updateParticles(pool: Particle[]): void {
  for (let i = pool.length - 1; i >= 0; i--) {
    const p = pool[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.06;
    p.vx *= 0.985;
    p.life--;
    if (p.life <= 0) {
      pool[i] = pool[pool.length - 1];
      pool.pop();
    }
  }
}

/** Draw all particles onto a canvas context using additive blending. */
export function drawParticles(
  ctx: CanvasRenderingContext2D,
  pool: Particle[],
): void {
  if (pool.length === 0) return;
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  for (const p of pool) {
    const alpha = Math.min(1, (p.life / p.maxLife) * 1.5);
    ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = prev;
}

/** Spawn a ripple at (x, y) for a note onset. */
export function spawnRipple(
  pool: Ripple[],
  x: number,
  y: number,
  color: string,
): void {
  const [r, g, b] = hexToRgb(color);
  pool.push({
    x,
    y,
    radius: 2,
    maxRadius: 30 + Math.random() * 20,
    life: 32,
    maxLife: 32,
    r,
    g,
    b,
  });
}

/** Update all ripples in-place, removing dead ones. */
export function updateRipples(pool: Ripple[]): void {
  for (let i = pool.length - 1; i >= 0; i--) {
    const r = pool[i];
    r.radius += (r.maxRadius - r.radius) * 0.1;
    r.life--;
    if (r.life <= 0) {
      pool[i] = pool[pool.length - 1];
      pool.pop();
    }
  }
}

/** Draw all ripples onto a canvas context using additive blending. */
export function drawRipples(
  ctx: CanvasRenderingContext2D,
  pool: Ripple[],
): void {
  if (pool.length === 0) return;
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  for (const r of pool) {
    const alpha = (r.life / r.maxLife) * 0.7;
    ctx.strokeStyle = `rgba(${r.r},${r.g},${r.b},${alpha.toFixed(3)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = prev;
}
