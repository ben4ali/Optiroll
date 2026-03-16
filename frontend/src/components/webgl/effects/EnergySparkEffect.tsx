import { useFrame } from '@react-three/fiber';
import { useCallback, useMemo, useRef } from 'react';
import * as THREE from 'three';

const MAX_SPARKS = 2000;

const vertexShader = /* glsl */ `
  attribute float aLife;
  attribute float aMaxLife;
  attribute float aSize;

  varying float vAlpha;

  void main() {
    float lifeRatio = aLife / aMaxLife;
    vAlpha = lifeRatio;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mvPosition.z) * (0.3 + 0.7 * lifeRatio);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vAlpha;
  uniform vec3 uColor;

  void main() {
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;

    // Sharp, bright spark core with fast falloff
    float glow = 1.0 - smoothstep(0.0, 0.3, dist);
    float streak = 1.0 - smoothstep(0.0, 0.5, abs(center.y) * 3.0);
    float shape = max(glow, streak * 0.5);

    float alpha = shape * vAlpha;
    gl_FragColor = vec4(uColor * 3.0, alpha);
  }
`;

interface SparkData {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  bounced: boolean;
}

export function EnergySparkEffect() {
  const pointsRef = useRef<THREE.Points>(null);
  const sparksRef = useRef<SparkData[]>([]);
  const uniformsRef = useRef({
    uColor: { value: new THREE.Color('#ffaa44') },
  });

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_SPARKS * 3);
    const lifes = new Float32Array(MAX_SPARKS);
    const maxLifes = new Float32Array(MAX_SPARKS);
    const sizes = new Float32Array(MAX_SPARKS);

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aLife', new THREE.BufferAttribute(lifes, 1));
    geo.setAttribute('aMaxLife', new THREE.BufferAttribute(maxLifes, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    return geo;
  }, []);

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

  const spawn = useCallback((x: number, y: number, color: THREE.Color) => {
    const pool = sparksRef.current;
    const count = 15 + Math.floor(Math.random() * 15);
    uniformsRef.current.uColor.value.lerp(color, 0.6);

    for (let i = 0; i < count; i++) {
      // Shoot upward with spread
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6;
      const speed = 0.8 + Math.random() * 2.0;
      const life = 30 + Math.floor(Math.random() * 30);

      pool.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        size: 0.08 + Math.random() * 0.2,
        bounced: false,
      });
    }

    if (pool.length > MAX_SPARKS) {
      pool.splice(0, pool.length - MAX_SPARKS);
    }
  }, []);

  useFrame(() => {
    const pool = sparksRef.current;
    const points = pointsRef.current;
    if (!points) return;

    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const lifes = geometry.attributes.aLife as THREE.BufferAttribute;
    const maxLifes = geometry.attributes.aMaxLife as THREE.BufferAttribute;
    const sizes = geometry.attributes.aSize as THREE.BufferAttribute;

    // Physics update
    for (let i = pool.length - 1; i >= 0; i--) {
      const s = pool[i];

      s.x += s.vx;
      s.y += s.vy;

      // Gravity pulling down
      s.vy -= 0.04;

      // Air drag
      s.vx *= 0.99;

      // Bounce at the hit line (approximate)
      if (s.vy < 0 && s.y <= s.y + s.vy && !s.bounced) {
        // Simple bounce when falling below spawn point
        if (s.life < s.maxLife * 0.5 && s.vy < -0.3) {
          s.vy *= -0.4;
          s.vx *= 0.8;
          s.bounced = true;
        }
      }

      s.life--;
      if (s.life <= 0) {
        pool[i] = pool[pool.length - 1];
        pool.pop();
      }
    }

    // Write to buffers
    const posArr = pos.array as Float32Array;
    const lifeArr = lifes.array as Float32Array;
    const maxLifeArr = maxLifes.array as Float32Array;
    const sizeArr = sizes.array as Float32Array;

    for (let i = 0; i < MAX_SPARKS; i++) {
      if (i < pool.length) {
        const s = pool[i];
        posArr[i * 3] = s.x;
        posArr[i * 3 + 1] = s.y;
        posArr[i * 3 + 2] = 0.1;
        lifeArr[i] = s.life;
        maxLifeArr[i] = s.maxLife;
        sizeArr[i] = s.size;
      } else {
        posArr[i * 3] = 0;
        posArr[i * 3 + 1] = -9999;
        posArr[i * 3 + 2] = 0;
        lifeArr[i] = 0;
        maxLifeArr[i] = 1;
        sizeArr[i] = 0;
      }
    }

    pos.needsUpdate = true;
    lifes.needsUpdate = true;
    maxLifes.needsUpdate = true;
    sizes.needsUpdate = true;

    points.geometry.setDrawRange(0, pool.length);
  });

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
    >
      <primitive object={{ spawn }} attach="userData" />
    </points>
  );
}

export interface EnergySparkHandle {
  spawn: (x: number, y: number, color: THREE.Color) => void;
}
