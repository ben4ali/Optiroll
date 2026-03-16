import { useFrame } from '@react-three/fiber';
import { useCallback, useMemo, useRef } from 'react';
import * as THREE from 'three';

// Maximum particles per active system
const MAX_PARTICLES_PER_BURST = 80;
const MAX_ACTIVE_BURSTS = 30;
const MAX_TOTAL_PARTICLES = MAX_PARTICLES_PER_BURST * MAX_ACTIVE_BURSTS;

// Vertex shader: positions particles, handles size and alpha
const vertexShader = /* glsl */ `
  attribute float aLife;
  attribute float aMaxLife;
  attribute float aSize;
  attribute float aAngle;

  varying float vAlpha;
  varying float vAngle;

  void main() {
    float lifeRatio = aLife / aMaxLife;
    vAlpha = lifeRatio * lifeRatio; // quadratic fade out
    vAngle = aAngle;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mvPosition.z) * lifeRatio;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Fragment shader: soft circular glow particle
const fragmentShader = /* glsl */ `
  varying float vAlpha;
  varying float vAngle;
  uniform vec3 uColor;

  void main() {
    vec2 center = gl_PointCoord - 0.5;

    // Rotate
    float c = cos(vAngle);
    float s = sin(vAngle);
    center = vec2(c * center.x - s * center.y, s * center.x + c * center.y);

    float dist = length(center);
    if (dist > 0.5) discard;

    // Soft glow falloff
    float glow = 1.0 - smoothstep(0.0, 0.5, dist);
    glow = pow(glow, 1.5);

    float alpha = glow * vAlpha;
    gl_FragColor = vec4(uColor * 2.0, alpha);
  }
`;

interface ParticleData {
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

interface NebulaSwirlProps {
  color?: THREE.Color;
}

export function NebulaSwirlEffect({ color }: NebulaSwirlProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const particlesRef = useRef<ParticleData[]>([]);
  const uniformsRef = useRef({
    uColor: { value: new THREE.Color('#4488ff') },
  });

  // Geometry with max particles
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_TOTAL_PARTICLES * 3);
    const lifes = new Float32Array(MAX_TOTAL_PARTICLES);
    const maxLifes = new Float32Array(MAX_TOTAL_PARTICLES);
    const sizes = new Float32Array(MAX_TOTAL_PARTICLES);
    const angles = new Float32Array(MAX_TOTAL_PARTICLES);

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aLife', new THREE.BufferAttribute(lifes, 1));
    geo.setAttribute('aMaxLife', new THREE.BufferAttribute(maxLifes, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1));

    return geo;
  }, []);

  // Material with additive blending
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: uniformsRef.current,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, []);

  // Spawn a nebula swirl burst at (x, y) with given color
  const spawn = useCallback((x: number, y: number, burstColor: THREE.Color) => {
    const pool = particlesRef.current;
    const count = 40 + Math.floor(Math.random() * 30);

    // Update the uniform color to the latest burst color (blended)
    uniformsRef.current.uColor.value.lerp(burstColor, 0.5);

    for (let i = 0; i < count; i++) {
      // Spiral starting angle with randomness
      const baseAngle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 0.3 + Math.random() * 1.2;
      // Rotational component for the swirl
      const tangentialSpeed = 0.5 + Math.random() * 1.0;
      const life = 40 + Math.floor(Math.random() * 40);

      pool.push({
        x,
        y,
        vx:
          Math.cos(baseAngle) * speed +
          Math.cos(baseAngle + Math.PI / 2) * tangentialSpeed,
        vy:
          Math.sin(baseAngle) * speed +
          Math.sin(baseAngle + Math.PI / 2) * tangentialSpeed,
        life,
        maxLife: life,
        size: 0.15 + Math.random() * 0.4,
        angle: Math.random() * Math.PI * 2,
        angleVel: (Math.random() - 0.5) * 0.15,
      });
    }

    // Trim if over limit
    if (pool.length > MAX_TOTAL_PARTICLES) {
      pool.splice(0, pool.length - MAX_TOTAL_PARTICLES);
    }
  }, []);

  useFrame(() => {
    const pool = particlesRef.current;
    const points = pointsRef.current;
    if (!points) return;

    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const lifes = geometry.attributes.aLife as THREE.BufferAttribute;
    const maxLifes = geometry.attributes.aMaxLife as THREE.BufferAttribute;
    const sizes = geometry.attributes.aSize as THREE.BufferAttribute;
    const angles = geometry.attributes.aAngle as THREE.BufferAttribute;

    // Update particles physics - swirl effect
    for (let i = pool.length - 1; i >= 0; i--) {
      const p = pool[i];

      // Add rotational swirl force
      const dx = p.vx;
      const dy = p.vy;
      const swirlStrength = 0.03 * (p.life / p.maxLife);
      p.vx += -dy * swirlStrength;
      p.vy += dx * swirlStrength;

      // Apply velocity with drag
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.975;
      p.vy *= 0.975;

      // Rotate
      p.angle += p.angleVel;

      p.life--;
      if (p.life <= 0) {
        pool[i] = pool[pool.length - 1];
        pool.pop();
      }
    }

    // Write to attribute buffers
    const posArr = pos.array as Float32Array;
    const lifeArr = lifes.array as Float32Array;
    const maxLifeArr = maxLifes.array as Float32Array;
    const sizeArr = sizes.array as Float32Array;
    const angleArr = angles.array as Float32Array;

    for (let i = 0; i < MAX_TOTAL_PARTICLES; i++) {
      if (i < pool.length) {
        const p = pool[i];
        posArr[i * 3] = p.x;
        posArr[i * 3 + 1] = p.y;
        posArr[i * 3 + 2] = 0.1;
        lifeArr[i] = p.life;
        maxLifeArr[i] = p.maxLife;
        sizeArr[i] = p.size;
        angleArr[i] = p.angle;
      } else {
        posArr[i * 3] = 0;
        posArr[i * 3 + 1] = -9999;
        posArr[i * 3 + 2] = 0;
        lifeArr[i] = 0;
        maxLifeArr[i] = 1;
        sizeArr[i] = 0;
        angleArr[i] = 0;
      }
    }

    pos.needsUpdate = true;
    lifes.needsUpdate = true;
    maxLifes.needsUpdate = true;
    sizes.needsUpdate = true;
    angles.needsUpdate = true;

    points.geometry.setDrawRange(0, pool.length);
  });

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
    >
      {/* Expose spawn method via ref */}
      <primitive object={{ spawn }} attach="userData" />
    </points>
  );
}

// Hook-friendly ref type
export interface NebulaSwirlHandle {
  spawn: (x: number, y: number, color: THREE.Color) => void;
}
