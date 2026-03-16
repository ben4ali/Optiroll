import type { WebGLHitEffect } from '@/lib/types';
import { useFrame, useThree } from '@react-three/fiber';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';

// ── Particle pool types ──

interface NebulaParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  angle: number;
  angleVel: number;
}

interface ShockwaveRing {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  maxScale: number;
  color: THREE.Color;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  originY: number;
}

interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

interface BurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

interface RiftParticle {
  cx: number;
  cy: number;
  angle: number;
  angVel: number;
  radius: number;
  radVel: number;
  life: number;
  maxLife: number;
  size: number;
  x: number;
  y: number;
}

// ── Limits ──

const MAX_NEBULA = 2400;
const MAX_SPARKS = 2000;
const MAX_RINGS = 60;
const MAX_DUST = 1600;
const MAX_BURST = 1400;
const MAX_RIFT = 1200;

// ── GLSL Shaders ──
// For orthographic: gl_PointSize = worldSize * pixelsPerUnit
// We pass uPPU (pixels per world unit) as a uniform.

const nebulaVertex = /* glsl */ `
  attribute float aLife;
  attribute float aMaxLife;
  attribute float aSize;
  attribute float aAngle;
  uniform float uPPU;
  varying float vAlpha;
  varying float vAngle;
  void main() {
    float lr = aLife / aMaxLife;
    vAlpha = lr * lr;
    vAngle = aAngle;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPPU * lr;
  }
`;

const nebulaFragment = /* glsl */ `
  varying float vAlpha;
  varying float vAngle;
  uniform vec3 uColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float cs = cos(vAngle), sn = sin(vAngle);
    c = vec2(cs*c.x - sn*c.y, sn*c.x + cs*c.y);
    float d = length(c);
    if (d > 0.5) discard;
    float g = pow(1.0 - smoothstep(0.0, 0.5, d), 1.5);
    gl_FragColor = vec4(uColor * 2.5, g * vAlpha);
  }
`;

const sparkVertex = /* glsl */ `
  attribute float aLife;
  attribute float aMaxLife;
  attribute float aSize;
  uniform float uPPU;
  varying float vAlpha;
  void main() {
    float lr = aLife / aMaxLife;
    vAlpha = lr;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPPU * (0.3 + 0.7 * lr);
  }
`;

const sparkFragment = /* glsl */ `
  varying float vAlpha;
  uniform vec3 uColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float g = 1.0 - smoothstep(0.0, 0.3, d);
    gl_FragColor = vec4(uColor * 3.0, g * vAlpha);
  }
`;

const ringVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ringFragment = /* glsl */ `
  varying vec2 vUv;
  uniform float uProgress;
  uniform vec3 uColor;
  void main() {
    vec2 c = vUv - 0.5;
    float d = length(c) * 2.0;
    float rr = uProgress;
    float rw = 0.08 * (1.0 - uProgress * 0.5);
    float ring = 1.0 - smoothstep(rw, rw + 0.15, abs(d - rr));
    float alpha = ring * (1.0 - uProgress) * 1.5;
    float inner = (1.0 - smoothstep(0.0, rr * 0.8, d)) * 0.3 * (1.0 - uProgress);
    alpha += inner;
    gl_FragColor = vec4(uColor * 2.0, alpha);
  }
`;

const glowVertex = /* glsl */ `
  attribute float aLife;
  attribute float aMaxLife;
  attribute float aSize;
  uniform float uPPU;
  varying float vAlpha;
  void main() {
    float lr = aLife / aMaxLife;
    vAlpha = lr * lr;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPPU * (0.35 + 0.65 * lr);
  }
`;

const glowFragment = /* glsl */ `
  varying float vAlpha;
  uniform vec3 uColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float g = pow(1.0 - smoothstep(0.0, 0.5, d), 2.2);
    gl_FragColor = vec4(uColor * 2.2, g * vAlpha);
  }
`;

// ── Handle ──

export interface ImpactManagerHandle {
  trigger: (x: number, y: number, color: THREE.Color) => void;
}

interface ImpactManagerProps {
  hitEffect: WebGLHitEffect;
}

export const ImpactManager = forwardRef<
  ImpactManagerHandle,
  ImpactManagerProps
>(function ImpactManager({ hitEffect }, ref) {
  const { viewport, size } = useThree();

  // Pixels per world unit (for gl_PointSize in orthographic)
  const ppu = size.width / viewport.width;

  // Particle pools
  const nebulaPool = useRef<NebulaParticle[]>([]);
  const sparkPool = useRef<Spark[]>([]);
  const ringPool = useRef<ShockwaveRing[]>([]);
  const dustPool = useRef<DustParticle[]>([]);
  const burstPool = useRef<BurstParticle[]>([]);
  const riftPool = useRef<RiftParticle[]>([]);

  // Colors (lerped toward most recent impact)
  const nebulaColor = useRef(new THREE.Color('#4488ff'));
  const sparkColor = useRef(new THREE.Color('#ffaa44'));
  const dustColor = useRef(new THREE.Color('#9fb0ff'));
  const burstColor = useRef(new THREE.Color('#ffd4a3'));
  const riftColor = useRef(new THREE.Color('#9fffdc'));

  // ── Geometries (lazy-init) ──

  const nebulaGeo = useRef<THREE.BufferGeometry | null>(null);
  if (!nebulaGeo.current) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(MAX_NEBULA * 3), 3),
    );
    geo.setAttribute(
      'aLife',
      new THREE.BufferAttribute(new Float32Array(MAX_NEBULA), 1),
    );
    geo.setAttribute(
      'aMaxLife',
      new THREE.BufferAttribute(new Float32Array(MAX_NEBULA), 1),
    );
    geo.setAttribute(
      'aSize',
      new THREE.BufferAttribute(new Float32Array(MAX_NEBULA), 1),
    );
    geo.setAttribute(
      'aAngle',
      new THREE.BufferAttribute(new Float32Array(MAX_NEBULA), 1),
    );
    nebulaGeo.current = geo;
  }

  const sparkGeo = useRef<THREE.BufferGeometry | null>(null);
  if (!sparkGeo.current) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(MAX_SPARKS * 3), 3),
    );
    geo.setAttribute(
      'aLife',
      new THREE.BufferAttribute(new Float32Array(MAX_SPARKS), 1),
    );
    geo.setAttribute(
      'aMaxLife',
      new THREE.BufferAttribute(new Float32Array(MAX_SPARKS), 1),
    );
    geo.setAttribute(
      'aSize',
      new THREE.BufferAttribute(new Float32Array(MAX_SPARKS), 1),
    );
    sparkGeo.current = geo;
  }

  const dustGeo = useRef<THREE.BufferGeometry | null>(null);
  if (!dustGeo.current) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(MAX_DUST * 3), 3),
    );
    geo.setAttribute(
      'aLife',
      new THREE.BufferAttribute(new Float32Array(MAX_DUST), 1),
    );
    geo.setAttribute(
      'aMaxLife',
      new THREE.BufferAttribute(new Float32Array(MAX_DUST), 1),
    );
    geo.setAttribute(
      'aSize',
      new THREE.BufferAttribute(new Float32Array(MAX_DUST), 1),
    );
    dustGeo.current = geo;
  }

  const burstGeo = useRef<THREE.BufferGeometry | null>(null);
  if (!burstGeo.current) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(MAX_BURST * 3), 3),
    );
    geo.setAttribute(
      'aLife',
      new THREE.BufferAttribute(new Float32Array(MAX_BURST), 1),
    );
    geo.setAttribute(
      'aMaxLife',
      new THREE.BufferAttribute(new Float32Array(MAX_BURST), 1),
    );
    geo.setAttribute(
      'aSize',
      new THREE.BufferAttribute(new Float32Array(MAX_BURST), 1),
    );
    burstGeo.current = geo;
  }

  const riftGeo = useRef<THREE.BufferGeometry | null>(null);
  if (!riftGeo.current) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(MAX_RIFT * 3), 3),
    );
    geo.setAttribute(
      'aLife',
      new THREE.BufferAttribute(new Float32Array(MAX_RIFT), 1),
    );
    geo.setAttribute(
      'aMaxLife',
      new THREE.BufferAttribute(new Float32Array(MAX_RIFT), 1),
    );
    geo.setAttribute(
      'aSize',
      new THREE.BufferAttribute(new Float32Array(MAX_RIFT), 1),
    );
    riftGeo.current = geo;
  }

  // ── Materials (lazy-init) ──

  const nebulaMat = useRef<THREE.ShaderMaterial | null>(null);
  if (!nebulaMat.current) {
    nebulaMat.current = new THREE.ShaderMaterial({
      vertexShader: nebulaVertex,
      fragmentShader: nebulaFragment,
      uniforms: {
        uColor: { value: nebulaColor.current },
        uPPU: { value: ppu },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }

  const sparkMat = useRef<THREE.ShaderMaterial | null>(null);
  if (!sparkMat.current) {
    sparkMat.current = new THREE.ShaderMaterial({
      vertexShader: sparkVertex,
      fragmentShader: sparkFragment,
      uniforms: {
        uColor: { value: sparkColor.current },
        uPPU: { value: ppu },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }

  const dustMat = useRef<THREE.ShaderMaterial | null>(null);
  if (!dustMat.current) {
    dustMat.current = new THREE.ShaderMaterial({
      vertexShader: glowVertex,
      fragmentShader: glowFragment,
      uniforms: {
        uColor: { value: dustColor.current },
        uPPU: { value: ppu },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }

  const burstMat = useRef<THREE.ShaderMaterial | null>(null);
  if (!burstMat.current) {
    burstMat.current = new THREE.ShaderMaterial({
      vertexShader: glowVertex,
      fragmentShader: glowFragment,
      uniforms: {
        uColor: { value: burstColor.current },
        uPPU: { value: ppu },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }

  const riftMat = useRef<THREE.ShaderMaterial | null>(null);
  if (!riftMat.current) {
    riftMat.current = new THREE.ShaderMaterial({
      vertexShader: glowVertex,
      fragmentShader: glowFragment,
      uniforms: {
        uColor: { value: riftColor.current },
        uPPU: { value: ppu },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }

  const ringPlane = useRef<THREE.PlaneGeometry | null>(null);
  if (!ringPlane.current) {
    ringPlane.current = new THREE.PlaneGeometry(1, 1);
  }

  const ringMats = useRef<THREE.ShaderMaterial[]>([]);
  if (ringMats.current.length === 0) {
    for (let i = 0; i < MAX_RINGS; i++) {
      ringMats.current.push(
        new THREE.ShaderMaterial({
          vertexShader: ringVertex,
          fragmentShader: ringFragment,
          uniforms: {
            uProgress: { value: 0 },
            uColor: { value: new THREE.Color() },
          },
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
    }
  }

  const ringMeshes = useRef<THREE.Mesh[]>([]);

  // Scale factor: how big is a "note column" in world units (gives us a reference scale)
  const colWidth = viewport.width / 88;

  // ── Trigger ──

  const trigger = useCallback(
    (x: number, y: number, color: THREE.Color) => {
      if (hitEffect === 'nebula') {
        const pool = nebulaPool.current;
        nebulaColor.current.lerp(color, 0.5);
        const count = 40 + Math.floor(Math.random() * 30);
        for (let i = 0; i < count; i++) {
          const baseAngle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
          // Velocities in world units per frame (colWidth gives ~0.17 units for a typical viewport)
          const speed = (0.008 + Math.random() * 0.03) * viewport.width * 0.04;
          const tangential =
            (0.01 + Math.random() * 0.025) * viewport.width * 0.04;
          const life = 40 + Math.floor(Math.random() * 40);
          pool.push({
            x,
            y,
            vx:
              Math.cos(baseAngle) * speed +
              Math.cos(baseAngle + Math.PI / 2) * tangential,
            vy:
              Math.sin(baseAngle) * speed +
              Math.sin(baseAngle + Math.PI / 2) * tangential,
            life,
            maxLife: life,
            size: colWidth * (0.3 + Math.random() * 0.6),
            angle: Math.random() * Math.PI * 2,
            angleVel: (Math.random() - 0.5) * 0.15,
          });
        }
        if (pool.length > MAX_NEBULA) pool.splice(0, pool.length - MAX_NEBULA);
      } else if (hitEffect === 'spark') {
        const pool = sparkPool.current;
        sparkColor.current.lerp(color, 0.6);
        const count = 15 + Math.floor(Math.random() * 15);
        for (let i = 0; i < count; i++) {
          // Shoot upward (positive Y in Three.js)
          const angle = Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6;
          const speed = (0.02 + Math.random() * 0.06) * viewport.width * 0.04;
          const life = 30 + Math.floor(Math.random() * 30);
          pool.push({
            x,
            y,
            originY: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life,
            maxLife: life,
            size: colWidth * (0.15 + Math.random() * 0.35),
          });
        }
        if (pool.length > MAX_SPARKS) pool.splice(0, pool.length - MAX_SPARKS);
      } else if (hitEffect === 'shockwave') {
        const pool = ringPool.current;
        const life = 25 + Math.floor(Math.random() * 15);
        pool.push({
          x,
          y,
          life,
          maxLife: life,
          maxScale: colWidth * (5 + Math.random() * 3),
          color: color.clone(),
        });
        if (pool.length > MAX_RINGS) pool.shift();
      } else if (hitEffect === 'stardust') {
        const pool = dustPool.current;
        dustColor.current.lerp(color, 0.55);
        const count = 120 + Math.floor(Math.random() * 80);
        for (let i = 0; i < count; i++) {
          const life = 70 + Math.floor(Math.random() * 50);
          const angle = Math.random() * Math.PI * 2;
          const speed = (0.008 + Math.random() * 0.03) * viewport.width * 0.04;
          pool.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life,
            maxLife: life,
            size: colWidth * (0.22 + Math.random() * 0.4),
          });
        }
        if (pool.length > MAX_DUST) pool.splice(0, pool.length - MAX_DUST);
      } else if (hitEffect === 'nova') {
        const pool = burstPool.current;
        burstColor.current.lerp(color, 0.6);
        const count = 80 + Math.floor(Math.random() * 60);
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = (0.02 + Math.random() * 0.08) * viewport.width * 0.04;
          const life = 25 + Math.floor(Math.random() * 20);
          pool.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life,
            maxLife: life,
            size: colWidth * (0.2 + Math.random() * 0.45),
          });
        }
        if (pool.length > MAX_BURST) pool.splice(0, pool.length - MAX_BURST);
      } else if (hitEffect === 'rift') {
        const pool = riftPool.current;
        riftColor.current.lerp(color, 0.5);
        const count = 60 + Math.floor(Math.random() * 50);
        for (let i = 0; i < count; i++) {
          const life = 50 + Math.floor(Math.random() * 35);
          const angle = Math.random() * Math.PI * 2;
          const radius = colWidth * (1 + Math.random() * 4);
          const angVel = (Math.random() - 0.5) * 0.12;
          const radVel = (Math.random() - 0.5) * colWidth * 0.02;
          const x0 = x + Math.cos(angle) * radius;
          const y0 = y + Math.sin(angle) * radius;
          pool.push({
            cx: x,
            cy: y,
            angle,
            angVel,
            radius,
            radVel,
            life,
            maxLife: life,
            size: colWidth * (0.18 + Math.random() * 0.38),
            x: x0,
            y: y0,
          });
        }
        if (pool.length > MAX_RIFT) pool.splice(0, pool.length - MAX_RIFT);
      }
    },
    [hitEffect, viewport.width, colWidth],
  );

  useImperativeHandle(ref, () => ({ trigger }), [trigger]);

  // ── Per-frame update ──

  useFrame(() => {
    // Keep PPU uniform current (handles resize)
    const currentPPU = size.width / viewport.width;
    if (nebulaMat.current) nebulaMat.current.uniforms.uPPU.value = currentPPU;
    if (sparkMat.current) sparkMat.current.uniforms.uPPU.value = currentPPU;
    if (dustMat.current) dustMat.current.uniforms.uPPU.value = currentPPU;
    if (burstMat.current) burstMat.current.uniforms.uPPU.value = currentPPU;
    if (riftMat.current) riftMat.current.uniforms.uPPU.value = currentPPU;

    // --- Nebula ---
    if (hitEffect === 'nebula' && nebulaGeo.current) {
      const pool = nebulaPool.current;
      for (let i = pool.length - 1; i >= 0; i--) {
        const p = pool[i];
        // Swirl force: cross-velocity rotation proportional to remaining life
        const swirl = 0.04 * (p.life / p.maxLife);
        const dx = p.vx,
          dy = p.vy;
        p.vx += -dy * swirl;
        p.vy += dx * swirl;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.975;
        p.vy *= 0.975;
        p.angle += p.angleVel;
        p.life--;
        if (p.life <= 0) {
          pool[i] = pool[pool.length - 1];
          pool.pop();
        }
      }
      flushPoints(nebulaGeo.current, pool, MAX_NEBULA, true);
    }

    // --- Sparks ---
    if (hitEffect === 'spark' && sparkGeo.current) {
      const pool = sparkPool.current;
      const gravity = viewport.height * 0.0003; // proportional gravity
      for (let i = pool.length - 1; i >= 0; i--) {
        const s = pool[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy -= gravity; // pull downward
        s.vx *= 0.99;
        // Bounce when falling below origin
        if (
          s.y < s.originY &&
          s.vy < -gravity * 3 &&
          s.life < s.maxLife * 0.6
        ) {
          s.vy *= -0.35;
          s.vx *= 0.7;
        }
        s.life--;
        if (s.life <= 0) {
          pool[i] = pool[pool.length - 1];
          pool.pop();
        }
      }
      flushPoints(sparkGeo.current, pool, MAX_SPARKS, false);
    }

    // --- Shockwave rings ---
    if (hitEffect === 'shockwave') {
      const pool = ringPool.current;
      for (let i = pool.length - 1; i >= 0; i--) {
        pool[i].life--;
        if (pool[i].life <= 0) pool.splice(i, 1);
      }
      const meshArr = ringMeshes.current;
      for (let i = 0; i < MAX_RINGS; i++) {
        const mesh = meshArr[i];
        if (!mesh) continue;
        if (i < pool.length) {
          const ring = pool[i];
          const progress = 1 - ring.life / ring.maxLife;
          const scale = ring.maxScale * progress;
          mesh.visible = true;
          mesh.position.set(ring.x, ring.y, 0.05);
          mesh.scale.set(scale, scale, 1);
          const mat = mesh.material as THREE.ShaderMaterial;
          mat.uniforms.uProgress.value = progress;
          mat.uniforms.uColor.value.copy(ring.color);
        } else {
          mesh.visible = false;
        }
      }
    }

    // --- Stardust ---
    if (hitEffect === 'stardust' && dustGeo.current) {
      const pool = dustPool.current;
      for (let i = pool.length - 1; i >= 0; i--) {
        const d = pool[i];
        d.x += d.vx;
        d.y += d.vy;
        d.vx *= 0.99;
        d.vy *= 0.99;
        d.life--;
        if (d.life <= 0) {
          pool[i] = pool[pool.length - 1];
          pool.pop();
        }
      }
      flushPoints(dustGeo.current, pool, MAX_DUST, false);
    }

    // --- Nova burst ---
    if (hitEffect === 'nova' && burstGeo.current) {
      const pool = burstPool.current;
      for (let i = pool.length - 1; i >= 0; i--) {
        const b = pool[i];
        b.x += b.vx;
        b.y += b.vy;
        b.vx *= 0.97;
        b.vy *= 0.97;
        b.life--;
        if (b.life <= 0) {
          pool[i] = pool[pool.length - 1];
          pool.pop();
        }
      }
      flushPoints(burstGeo.current, pool, MAX_BURST, false);
    }

    // --- Rift drift ---
    if (hitEffect === 'rift' && riftGeo.current) {
      const pool = riftPool.current;
      for (let i = pool.length - 1; i >= 0; i--) {
        const r = pool[i];
        r.angle += r.angVel;
        r.radius += r.radVel;
        r.x = r.cx + Math.cos(r.angle) * r.radius;
        r.y = r.cy + Math.sin(r.angle) * r.radius;
        r.angVel *= 0.985;
        r.radVel *= 0.99;
        r.life--;
        if (r.life <= 0) {
          pool[i] = pool[pool.length - 1];
          pool.pop();
        }
      }
      flushPoints(riftGeo.current, pool, MAX_RIFT, false);
    }
  });

  return (
    <group>
      {hitEffect === 'nebula' && (
        <points
          geometry={nebulaGeo.current!}
          material={nebulaMat.current!}
          frustumCulled={false}
        />
      )}
      {hitEffect === 'spark' && (
        <points
          geometry={sparkGeo.current!}
          material={sparkMat.current!}
          frustumCulled={false}
        />
      )}
      {hitEffect === 'stardust' && (
        <points
          geometry={dustGeo.current!}
          material={dustMat.current!}
          frustumCulled={false}
        />
      )}
      {hitEffect === 'nova' && (
        <points
          geometry={burstGeo.current!}
          material={burstMat.current!}
          frustumCulled={false}
        />
      )}
      {hitEffect === 'rift' && (
        <points
          geometry={riftGeo.current!}
          material={riftMat.current!}
          frustumCulled={false}
        />
      )}
      {hitEffect === 'shockwave' &&
        ringMats.current.map((mat, i) => (
          <mesh
            key={i}
            ref={el => {
              if (el) ringMeshes.current[i] = el;
            }}
            geometry={ringPlane.current!}
            material={mat}
            visible={false}
            frustumCulled={false}
          />
        ))}
    </group>
  );
});

// Flush particle pool data into GPU buffer attributes
function flushPoints(
  geo: THREE.BufferGeometry,
  pool: Array<{
    x: number;
    y: number;
    life: number;
    maxLife: number;
    size: number;
    angle?: number;
  }>,
  max: number,
  hasAngle: boolean,
) {
  const pos = (geo.attributes.position as THREE.BufferAttribute)
    .array as Float32Array;
  const life = (geo.attributes.aLife as THREE.BufferAttribute)
    .array as Float32Array;
  const maxLife = (geo.attributes.aMaxLife as THREE.BufferAttribute)
    .array as Float32Array;
  const sz = (geo.attributes.aSize as THREE.BufferAttribute)
    .array as Float32Array;
  const angle = hasAngle
    ? ((geo.attributes.aAngle as THREE.BufferAttribute).array as Float32Array)
    : null;

  for (let i = 0; i < max; i++) {
    if (i < pool.length) {
      const p = pool[i];
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y;
      pos[i * 3 + 2] = 0.1;
      life[i] = p.life;
      maxLife[i] = p.maxLife;
      sz[i] = p.size;
      if (angle && p.angle !== undefined) angle[i] = p.angle;
    } else {
      pos[i * 3] = 0;
      pos[i * 3 + 1] = -9999;
      pos[i * 3 + 2] = 0;
      life[i] = 0;
      maxLife[i] = 1;
      sz[i] = 0;
      if (angle) angle[i] = 0;
    }
  }

  geo.attributes.position.needsUpdate = true;
  geo.attributes.aLife.needsUpdate = true;
  geo.attributes.aMaxLife.needsUpdate = true;
  geo.attributes.aSize.needsUpdate = true;
  if (hasAngle && geo.attributes.aAngle)
    geo.attributes.aAngle.needsUpdate = true;
  geo.setDrawRange(0, pool.length);
}
