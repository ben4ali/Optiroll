import type { ColorScheme } from '@/lib/colors';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { MAX_PITCH, MIN_PITCH, PITCH_RANGE } from './constants';

interface HitLineGlowProps {
  activePitches: Uint8Array;
  colorScheme: ColorScheme;
  viewWidth: number;
  hitLineY: number;
}

// Vertex shader for the glow quads
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment shader: vertical gradient glow
const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uIntensity;

  void main() {
    // vUv.y: 0 = bottom, 1 = top
    // Glow concentrated at bottom (hit line), fading up
    float glow = exp(-vUv.y * 3.0) * uIntensity;
    float spillDown = exp(-(1.0 - vUv.y) * 8.0) * uIntensity * 0.4;
    float alpha = glow + spillDown;
    gl_FragColor = vec4(uColor * 2.5, alpha);
  }
`;

const MAX_GLOW_COLUMNS = 88;

export function HitLineGlow({
  activePitches,
  colorScheme,
  viewWidth,
  hitLineY,
}: HitLineGlowProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshesRef = useRef<THREE.Mesh[]>([]);

  const palette = useMemo(() => {
    return colorScheme.colors.map(hex => new THREE.Color(hex));
  }, [colorScheme]);

  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  const materials = useMemo(() => {
    return Array.from(
      { length: MAX_GLOW_COLUMNS },
      () =>
        new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          uniforms: {
            uColor: { value: new THREE.Color() },
            uIntensity: { value: 0 },
          },
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
    );
  }, []);

  // Hit line mesh (thin bright line)
  const hitLineMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.3, 0.3, 0.4),
      transparent: true,
      opacity: 0.5,
    });
  }, []);

  useFrame(() => {
    const colWidth = viewWidth / PITCH_RANGE;
    const halfWidth = viewWidth / 2;
    const pulse = 0.85 + 0.15 * Math.sin(performance.now() * 0.003);
    const glowHeight = 3.0; // world units above hit line

    let meshIdx = 0;
    for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
      const mesh = meshesRef.current[meshIdx];
      if (!mesh) {
        meshIdx++;
        continue;
      }

      if (activePitches[p]) {
        const pc = activePitches[p] - 1;
        const x = (p - MIN_PITCH) * colWidth + colWidth / 2 - halfWidth;

        mesh.visible = true;
        mesh.position.set(x, hitLineY + glowHeight / 2, 0.02);
        mesh.scale.set(colWidth * 1.8, glowHeight, 1);

        const mat = mesh.material as THREE.ShaderMaterial;
        mat.uniforms.uColor.value.copy(palette[pc]);
        mat.uniforms.uIntensity.value = 0.8 * pulse;
      } else {
        mesh.visible = false;
      }
      meshIdx++;
    }

    // Hide remaining
    for (let i = meshIdx; i < MAX_GLOW_COLUMNS; i++) {
      const mesh = meshesRef.current[i];
      if (mesh) mesh.visible = false;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Glow columns */}
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
      {/* Thin hit line */}
      <mesh position={[0, hitLineY, 0.01]} frustumCulled={false}>
        <planeGeometry args={[viewWidth, 0.04]} />
        <primitive object={hitLineMaterial} attach="material" />
      </mesh>
    </group>
  );
}
