import { useFrame } from '@react-three/fiber';
import { useCallback, useMemo, useRef } from 'react';
import * as THREE from 'three';

const MAX_RINGS = 60;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform float uProgress;
  uniform vec3 uColor;

  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center) * 2.0;

    // Ring shape: sharp ring band that expands with progress
    float ringRadius = uProgress;
    float ringWidth = 0.08 * (1.0 - uProgress * 0.5);
    float ring = 1.0 - smoothstep(ringWidth, ringWidth + 0.15, abs(dist - ringRadius));

    // Fade out over life
    float alpha = ring * (1.0 - uProgress) * 1.5;

    // Inner glow
    float innerGlow = (1.0 - smoothstep(0.0, ringRadius * 0.8, dist)) * 0.3 * (1.0 - uProgress);

    alpha += innerGlow;
    gl_FragColor = vec4(uColor * 2.0, alpha);
  }
`;

interface RingData {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  maxScale: number;
  color: THREE.Color;
}

export function ShockwaveEffect() {
  const groupRef = useRef<THREE.Group>(null);
  const ringsRef = useRef<RingData[]>([]);
  const meshesRef = useRef<THREE.Mesh[]>([]);

  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  // Create pool of ring meshes
  const materials = useMemo(() => {
    return Array.from(
      { length: MAX_RINGS },
      () =>
        new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          uniforms: {
            uProgress: { value: 0 },
            uColor: { value: new THREE.Color('#ffffff') },
          },
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
    );
  }, []);

  const spawn = useCallback((x: number, y: number, color: THREE.Color) => {
    const pool = ringsRef.current;
    const life = 25 + Math.floor(Math.random() * 15);
    pool.push({
      x,
      y,
      life,
      maxLife: life,
      maxScale: 2.0 + Math.random() * 1.5,
      color: color.clone(),
    });

    if (pool.length > MAX_RINGS) {
      pool.shift();
    }
  }, []);

  useFrame(() => {
    const pool = ringsRef.current;
    const meshes = meshesRef.current;

    // Update rings
    for (let i = pool.length - 1; i >= 0; i--) {
      pool[i].life--;
      if (pool[i].life <= 0) {
        pool.splice(i, 1);
      }
    }

    // Update meshes
    for (let i = 0; i < MAX_RINGS; i++) {
      const mesh = meshes[i];
      if (!mesh) continue;

      if (i < pool.length) {
        const ring = pool[i];
        const progress = 1 - ring.life / ring.maxLife;
        const scale = ring.maxScale * progress;

        mesh.visible = true;
        mesh.position.set(ring.x, ring.y, 0.05);
        mesh.scale.set(scale * 3, scale * 3, 1);

        const mat = mesh.material as THREE.ShaderMaterial;
        mat.uniforms.uProgress.value = progress;
        mat.uniforms.uColor.value.copy(ring.color);
      } else {
        mesh.visible = false;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {materials.map((mat, i) => (
        <mesh
          key={i}
          ref={el => {
            if (el) meshesRef.current[i] = el;
          }}
          geometry={geometry}
          material={mat}
          visible={false}
          frustumCulled={false}
        />
      ))}
      <primitive object={{ spawn }} attach="userData" />
    </group>
  );
}

export interface ShockwaveHandle {
  spawn: (x: number, y: number, color: THREE.Color) => void;
}
