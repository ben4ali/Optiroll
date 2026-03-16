import type { ColorScheme } from '@/lib/colors';
import type { NoteData } from '@/lib/types';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  MAX_PITCH,
  MIN_PITCH,
  PITCH_RANGE,
  VISIBLE_SECONDS,
} from './constants';

const MAX_INSTANCES = 4096;

// Reusable temporaries to avoid per-frame allocation
const _color = new THREE.Color();
const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();

interface NoteMeshesProps {
  notes: NoteData[];
  currentTime: number;
  playing: boolean;
  colorScheme: ColorScheme;
  octave: number;
  transpose: number;
  viewWidth: number;
  viewHeight: number;
  hitLineY: number;
  onActiveNotes: (pitches: Uint8Array) => void;
  onNoteImpact: (
    x: number,
    y: number,
    color: THREE.Color,
    pitch: number,
  ) => void;
}

export function NoteMeshes({
  notes,
  currentTime,
  playing,
  colorScheme,
  octave,
  transpose,
  viewWidth,
  viewHeight,
  hitLineY,
  onActiveNotes,
  onNoteImpact,
}: NoteMeshesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const shadowRef = useRef<THREE.InstancedMesh>(null);
  const spawnedRef = useRef<Set<number>>(new Set());
  const prevTimeRef = useRef(0);
  const activePitchesRef = useRef(new Uint8Array(128));

  // Sort & filter notes
  const sorted = useMemo(() => {
    return notes
      .filter(n => n.pitch >= MIN_PITCH && n.pitch <= MAX_PITCH)
      .slice()
      .sort((a, b) => a.start - b.start);
  }, [notes]);

  // Pre-compute end times
  const endTimes = useMemo(() => {
    return new Float64Array(sorted.map(n => n.start + n.duration));
  }, [sorted]);

  // Color palette as THREE.Color objects
  const palette = useMemo(() => {
    return colorScheme.colors.map(hex => new THREE.Color(hex));
  }, [colorScheme]);

  // Reset spawned set on note change
  useEffect(() => {
    spawnedRef.current.clear();
    prevTimeRef.current = 0;
  }, [sorted]);

  // Slightly rounded box geometry for each note
  const geometry = useMemo(
    () => new RoundedBoxGeometry(1, 1, 0.08, 2, 0.08),
    [],
  );

  // MeshBasicMaterial with toneMapped:false  — colors > 1.0 will bleed into bloom
  // This is unlit, so the notes are purely self-illuminated. No scene lights needed.
  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      toneMapped: false,
      transparent: false,
      opacity: 1,
    });
  }, []);

  const glowMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      toneMapped: false,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, []);

  const shadowMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      toneMapped: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
  }, []);

  useFrame(() => {
    const mesh = meshRef.current;
    const glowMesh = glowRef.current;
    const shadowMesh = shadowRef.current;
    if (!mesh || !glowMesh || !shadowMesh) return;

    const t = currentTime;
    const colWidth = viewWidth / PITCH_RANGE;
    const pxPerSecond = viewHeight / VISIBLE_SECONDS;

    // Detect rewind
    if (t < prevTimeRef.current - 0.5) {
      spawnedRef.current.clear();
    }
    prevTimeRef.current = t;

    const activePitches = activePitchesRef.current;
    activePitches.fill(0);

    // Binary search for visible time window
    const visibleStart = t - 0.5;
    const visibleEnd = t + VISIBLE_SECONDS + 0.5;

    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (endTimes[mid] < visibleStart) lo = mid + 1;
      else hi = mid;
    }

    const pulse = 0.85 + 0.15 * Math.sin(performance.now() * 0.003);
    const halfWidth = viewWidth / 2;
    let instanceIdx = 0;

    for (let i = lo; i < sorted.length && instanceIdx < MAX_INSTANCES; i++) {
      const note = sorted[i];
      if (note.start > visibleEnd) break;

      const end = endTimes[i];
      const effectivePitch = note.pitch + octave * 12 + transpose;
      if (effectivePitch < MIN_PITCH || effectivePitch > MAX_PITCH) continue;

      const noteTopTime = note.start - t;
      const noteBotTime = end - t;

      // Y in world space (notes above hitLine fall down toward it)
      const noteTopY = hitLineY + noteTopTime * pxPerSecond;
      const noteBotY = hitLineY + noteBotTime * pxPerSecond;
      const barHeight = Math.abs(noteTopY - noteBotY);
      if (barHeight < 0.001) continue;

      const barWidth = colWidth * 0.92;
      const x =
        (effectivePitch - MIN_PITCH) * colWidth + colWidth / 2 - halfWidth;
      const y = (noteTopY + noteBotY) / 2;

      const pc = effectivePitch % 12;
      const active = t >= note.start && t < end;

      if (active) {
        activePitches[effectivePitch] = pc + 1;

        // Spawn impact effect once per note onset
        if (!spawnedRef.current.has(i)) {
          spawnedRef.current.add(i);
          _color.copy(palette[pc]);
          onNoteImpact(x, hitLineY, _color.clone(), effectivePitch);
        }
      }

      // Shadow box (slightly offset and larger)
      _position.set(x, y - barHeight * 0.04, -0.02);
      _scale.set(barWidth * 1.06, barHeight * 1.04, 1);
      _matrix.compose(_position, _quaternion, _scale);
      shadowMesh.setMatrixAt(instanceIdx, _matrix);

      // Transform main box
      _position.set(x, y, 0);
      _scale.set(barWidth, barHeight, 1);
      _matrix.compose(_position, _quaternion, _scale);
      mesh.setMatrixAt(instanceIdx, _matrix);

      // Glow box (slightly larger for boxed glow)
      _position.set(x, y, -0.01);
      _scale.set(barWidth * 1.08, barHeight * 1.06, 1);
      _matrix.compose(_position, _quaternion, _scale);
      glowMesh.setMatrixAt(instanceIdx, _matrix);

      // Color — active notes get bright (>1.0) so bloom catches them
      const baseColor = palette[pc];
      if (active) {
        _color.setRGB(
          baseColor.r * 2.0 * pulse,
          baseColor.g * 2.0 * pulse,
          baseColor.b * 2.0 * pulse,
        );
      } else {
        // Opaque base color for idle notes
        _color.setRGB(baseColor.r * 1.0, baseColor.g * 1.0, baseColor.b * 1.0);
      }
      mesh.setColorAt(instanceIdx, _color);

      // Shadow tint based on base color
      _color.setRGB(baseColor.r * 0.2, baseColor.g * 0.2, baseColor.b * 0.2);
      shadowMesh.setColorAt(instanceIdx, _color);

      // Glow color for boxed aura
      if (active) {
        _color.setRGB(
          baseColor.r * 2.3 * pulse,
          baseColor.g * 2.3 * pulse,
          baseColor.b * 2.3 * pulse,
        );
      } else {
        _color.setRGB(baseColor.r * 1.4, baseColor.g * 1.4, baseColor.b * 1.4);
      }
      glowMesh.setColorAt(instanceIdx, _color);

      instanceIdx++;
    }

    // Hide unused instances by shrinking to zero
    _scale.set(0, 0, 0);
    for (let j = instanceIdx; j < mesh.count; j++) {
      _matrix.compose(_position.set(0, -9999, 0), _quaternion, _scale);
      mesh.setMatrixAt(j, _matrix);
      shadowMesh.setMatrixAt(j, _matrix);
      glowMesh.setMatrixAt(j, _matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    shadowMesh.instanceMatrix.needsUpdate = true;
    glowMesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (shadowMesh.instanceColor) shadowMesh.instanceColor.needsUpdate = true;
    if (glowMesh.instanceColor) glowMesh.instanceColor.needsUpdate = true;
    mesh.count = Math.max(instanceIdx, 1);
    shadowMesh.count = mesh.count;
    glowMesh.count = mesh.count;

    // Report active state to parent
    onActiveNotes(activePitches);
  });

  return (
    <group>
      <instancedMesh
        ref={shadowRef}
        args={[geometry, shadowMaterial, MAX_INSTANCES]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, MAX_INSTANCES]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={glowRef}
        args={[geometry, glowMaterial, MAX_INSTANCES]}
        frustumCulled={false}
      />
    </group>
  );
}
