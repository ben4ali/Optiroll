import type { ColorScheme } from '@/lib/colors';
import { DEFAULT_COLOR_SCHEME } from '@/lib/colors';
import type { NoteData, WebGLHitEffect } from '@/lib/types';
import { Canvas, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  ImpactManager,
  type ImpactManagerHandle,
} from './webgl/effects/ImpactManager';
import { GridLines } from './webgl/GridLines';
import { HitLineGlow } from './webgl/HitLineGlow';
import { NoteMeshes } from './webgl/NoteMeshes';
import { PianoKeyboardOverlay } from './webgl/PianoKeyboardOverlay';

const KEYBOARD_HEIGHT_PX = 140;

// Inner scene component - has access to Three.js context via useThree
function PianoRollScene({
  notes,
  currentTime,
  playing,
  colorScheme,
  octave,
  transpose,
  hitEffect,
  bloomStrength,
  bloomRadius,
  studioDarkness,
  showKeyDividers,
  onActivePitchesChange,
}: {
  notes: NoteData[];
  currentTime: number;
  playing: boolean;
  colorScheme: ColorScheme;
  octave: number;
  transpose: number;
  hitEffect: WebGLHitEffect;
  bloomStrength: number;
  bloomRadius: number;
  studioDarkness: number;
  showKeyDividers: boolean;
  onActivePitchesChange: (pitches: Uint8Array) => void;
}) {
  const { viewport, invalidate } = useThree();
  const impactRef = useRef<ImpactManagerHandle>(null);
  const activePitchesRef = useRef(new Uint8Array(128));

  // World-space dimensions from the orthographic viewport
  const viewWidth = viewport.width;
  const viewHeight = viewport.height;
  const hitLineY = -viewHeight / 2; // align hit line with bottom edge

  const onActiveNotes = useCallback(
    (pitches: Uint8Array) => {
      const prev = activePitchesRef.current;
      let changed = false;
      for (let i = 0; i < 128; i++) {
        if (prev[i] !== pitches[i]) {
          changed = true;
          break;
        }
      }
      if (changed) {
        const copy = new Uint8Array(pitches);
        activePitchesRef.current = copy;
        onActivePitchesChange(copy);
      }
    },
    [onActivePitchesChange],
  );

  const onNoteImpact = useCallback(
    (x: number, y: number, color: THREE.Color) => {
      impactRef.current?.trigger(x, y, color);
    },
    [],
  );

  // Background color: 0 = pitch black (#000), 1 = dim studio gray
  const bgColor = useMemo(() => {
    return new THREE.Color(
      0.1 * studioDarkness,
      0.1 * studioDarkness,
      0.12 * studioDarkness,
    );
  }, [studioDarkness]);

  // Invalidate on scrubbing while paused
  useEffect(() => {
    if (!playing) invalidate();
  }, [currentTime, playing, invalidate]);

  return (
    <>
      <color attach="background" args={[bgColor.r, bgColor.g, bgColor.b]} />

      {/* No scene lights needed - notes use emissive-only MeshBasicMaterial */}

      {/* Grid lines */}
      <GridLines
        viewWidth={viewWidth}
        viewHeight={viewHeight}
        hitLineY={hitLineY}
        showKeyDividers={showKeyDividers}
      />

      {/* Falling note meshes */}
      <NoteMeshes
        notes={notes}
        currentTime={currentTime}
        playing={playing}
        colorScheme={colorScheme}
        octave={octave}
        transpose={transpose}
        viewWidth={viewWidth}
        viewHeight={viewHeight}
        hitLineY={hitLineY}
        onActiveNotes={onActiveNotes}
        onNoteImpact={onNoteImpact}
      />

      {/* Hit line glow columns */}
      <HitLineGlow
        activePitches={activePitchesRef.current}
        colorScheme={colorScheme}
        viewWidth={viewWidth}
        hitLineY={hitLineY}
      />

      {/* Impact effects (particles / shockwave / sparks) */}
      <ImpactManager ref={impactRef} hitEffect={hitEffect} />

      {/* Post-processing */}
      <EffectComposer>
        <Bloom
          intensity={bloomStrength}
          luminanceThreshold={0.05}
          luminanceSmoothing={0.9}
          mipmapBlur
          radius={bloomRadius}
        />
      </EffectComposer>
    </>
  );
}

export interface PianoRollGLProps {
  notes: NoteData[];
  currentTime: number;
  playing: boolean;
  colorScheme?: ColorScheme;
  octave?: number;
  transpose?: number;
  hitEffect?: WebGLHitEffect;
  bloomStrength?: number;
  bloomRadius?: number;
  studioDarkness?: number;
  showKeyDividers?: boolean;
}

export function PianoRollGL({
  notes,
  currentTime,
  playing,
  colorScheme = DEFAULT_COLOR_SCHEME,
  octave = 0,
  transpose = 0,
  hitEffect = 'nebula',
  bloomStrength = 1.5,
  bloomRadius = 0.4,
  studioDarkness = 0.0,
  showKeyDividers = true,
}: PianoRollGLProps) {
  const [activePitches, setActivePitches] = useState(() => new Uint8Array(128));

  const handleActivePitchesChange = useCallback((pitches: Uint8Array) => {
    setActivePitches(pitches);
  }, []);

  return (
    <div className="w-full h-full flex flex-col" style={{ background: '#000' }}>
      {/* WebGL Canvas */}
      <div className="flex-1 min-h-0 relative">
        <div
          className="absolute top-0 left-0 right-0 z-10 pointer-events-none"
          style={{
            height: '30%',
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0))',
          }}
        />
        <Canvas
          orthographic
          camera={{
            position: [0, 0, 10],
            zoom: 1,
            near: 0.1,
            far: 100,
          }}
          gl={{
            antialias: true,
            toneMapping: THREE.NoToneMapping,
            powerPreference: 'high-performance',
          }}
          dpr={[1, 2]}
          frameloop={playing ? 'always' : 'demand'}
          style={{ background: '#000' }}
        >
          <PianoRollScene
            notes={notes}
            currentTime={currentTime}
            playing={playing}
            colorScheme={colorScheme}
            octave={octave}
            transpose={transpose}
            hitEffect={hitEffect}
            bloomStrength={bloomStrength}
            bloomRadius={bloomRadius}
            studioDarkness={studioDarkness}
            showKeyDividers={showKeyDividers}
            onActivePitchesChange={handleActivePitchesChange}
          />
        </Canvas>
      </div>

      {/* Piano keyboard (2D Canvas overlay below WebGL) */}
      <PianoKeyboardOverlay
        activePitches={activePitches}
        colorScheme={colorScheme}
        height={KEYBOARD_HEIGHT_PX}
        showKeyDividers={showKeyDividers}
      />
    </div>
  );
}
