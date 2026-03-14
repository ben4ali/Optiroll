import { ALL_INSTRUMENTS, DEFAULT_INSTRUMENT } from '@/lib/types';
import type { NoteData, PlaybackState } from '@/lib/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ElectricPiano,
  Mellotron,
  Reverb,
  Soundfont,
  SplendidGrandPiano,
} from 'smplr';

const LOOK_AHEAD_S = 0.15;

// All smplr instrument classes share this shape
type AnyInstrument = {
  output: {
    setVolume: (vol: number) => void;
    addEffect(
      name: string,
      effect: AudioNode | { input: AudioNode },
      mixValue: number,
    ): void;
    sendEffect(name: string, mix: number): void;
  };
  start: (event: {
    note: number;
    velocity?: number;
    time?: number;
    duration?: number;
    detune?: number;
  }) => unknown;
  stop: (target?: unknown) => void;
  disconnect: () => void;
  load: Promise<unknown>;
};

export interface UsePianoPlayerReturn {
  playbackState: PlaybackState;
  currentTime: number;
  speed: number;
  instrument: string;
  loading: boolean;
  volume: number;
  reverbMix: number;
  humanize: boolean;
  play: () => void;
  pause: () => void;
  stop: () => void;
  setSpeed: (s: number) => void;
  setInstrument: (name: string) => void;
  setVolume: (v: number) => void;
  setReverbMix: (mix: number) => void;
  setHumanize: (on: boolean) => void;
}

export function usePianoPlayer(notes: NoteData[]): UsePianoPlayerReturn {
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeedState] = useState(1);
  const [instrument, setInstrumentState] = useState(DEFAULT_INSTRUMENT);
  const [loading, setLoading] = useState(false);
  const [volume, setVolumeState] = useState(100);
  const [reverbMix, setReverbMixState] = useState(0.2);
  const [humanize, setHumanizeState] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const instRef = useRef<AnyInstrument | null>(null);
  const reverbRef = useRef<Reverb | null>(null);
  const rafRef = useRef<number>(0);
  const startWallRef = useRef(0);
  const startOffsetRef = useRef(0);
  const speedRef = useRef(1);
  const scheduledRef = useRef<Set<number>>(new Set());
  const stateRef = useRef<PlaybackState>('idle');
  const notesRef = useRef(notes);
  const instrumentRef = useRef(instrument);
  const volumeRef = useRef(volume);
  const reverbMixRef = useRef(reverbMix);
  const humanizeRef = useRef(humanize);

  notesRef.current = notes;
  instrumentRef.current = instrument;

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const totalDuration = notes.reduce(
    (max, n) => Math.max(max, n.start + n.duration),
    0,
  );
  const totalDurationRef = useRef(totalDuration);
  totalDurationRef.current = totalDuration;

  // Ensure AudioContext exists and is running (must be called from user gesture)
  const ensureAudioContext = useCallback(async () => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === 'suspended') {
      await ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const loadInstrument = useCallback(
    async (name: string) => {
      setLoading(true);
      try {
        const ctx = await ensureAudioContext();
        // If the context is still suspended (no user gesture yet), bail out
        if (ctx.state === 'suspended') {
          return;
        }

        // Disconnect previous instrument
        instRef.current?.disconnect();
        instRef.current = null;

        const option = ALL_INSTRUMENTS.find(i => i.value === name);
        if (!option) return;

        let inst: AnyInstrument;

        switch (option.type) {
          case 'splendid':
            inst = new SplendidGrandPiano(ctx) as unknown as AnyInstrument;
            break;
          case 'electric':
            inst = new ElectricPiano(ctx, {
              instrument: option.epName!,
            }) as unknown as AnyInstrument;
            break;
          case 'mellotron':
            inst = new Mellotron(ctx, {
              instrument: option.mellotronName!,
            }) as unknown as AnyInstrument;
            break;
          case 'soundfont':
          default:
            inst = new Soundfont(ctx, {
              instrument: option.sfName ?? name,
            }) as unknown as AnyInstrument;
            break;
        }

        await inst.load;

        // Apply current volume
        inst.output.setVolume(volumeRef.current);

        // Lazily create reverb (once, shared across instrument changes)
        if (!reverbRef.current) {
          reverbRef.current = new Reverb(ctx);
          await reverbRef.current.ready();
        }

        // Attach reverb to this instrument's output
        inst.output.addEffect('reverb', reverbRef.current, reverbMixRef.current);

        instRef.current = inst;
      } finally {
        setLoading(false);
      }
    },
    [ensureAudioContext],
  );

  // Reload instrument when user explicitly changes it via the dropdown.
  const prevInstrumentRef = useRef(instrument);
  useEffect(() => {
    if (instrument === prevInstrumentRef.current) return;
    prevInstrumentRef.current = instrument;
    if (ctxRef.current) {
      loadInstrument(instrument);
    } else {
      instRef.current?.disconnect();
      instRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrument]);

  // Animation / scheduling loop
  const tick = useCallback(() => {
    if (stateRef.current !== 'playing') return;

    const elapsed =
      ((performance.now() - startWallRef.current) / 1000) * speedRef.current;
    const t = startOffsetRef.current + elapsed;

    setCurrentTime(t);

    const inst = instRef.current;
    const ctx = ctxRef.current;
    const currentNotes = notesRef.current;
    if (inst && ctx) {
      for (let i = 0; i < currentNotes.length; i++) {
        if (scheduledRef.current.has(i)) continue;
        const note = currentNotes[i];
        if (
          note.start <= t + LOOK_AHEAD_S &&
          note.start + note.duration >= t
        ) {
          scheduledRef.current.add(i);
          const delay = Math.max(0, (note.start - t) / speedRef.current);
          let acTime = ctx.currentTime + delay;
          let velocity = 80;
          let detune = 0;

          if (humanizeRef.current) {
            velocity += Math.round((Math.random() - 0.5) * 20);
            velocity = Math.max(1, Math.min(127, velocity));
            acTime += (Math.random() - 0.5) * 0.03;
            detune = (Math.random() - 0.5) * 10;
          }

          inst.start({
            note: note.pitch,
            velocity,
            time: acTime,
            duration: note.duration / speedRef.current,
            detune,
          });
        }
      }
    }

    if (t >= totalDurationRef.current) {
      stateRef.current = 'idle';
      setPlaybackState('idle');
      setCurrentTime(0);
      scheduledRef.current.clear();
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const play = useCallback(async () => {
    if (stateRef.current === 'playing') return;

    await ensureAudioContext();

    // Lazy-load instrument on first play
    if (!instRef.current) {
      await loadInstrument(instrumentRef.current);
    }

    if (stateRef.current === 'idle') {
      scheduledRef.current.clear();
      startOffsetRef.current = 0;
    }

    startWallRef.current = performance.now();
    stateRef.current = 'playing';
    setPlaybackState('playing');
    rafRef.current = requestAnimationFrame(tick);
  }, [ensureAudioContext, loadInstrument, tick]);

  const pause = useCallback(() => {
    if (stateRef.current !== 'playing') return;
    cancelAnimationFrame(rafRef.current);
    const elapsed =
      ((performance.now() - startWallRef.current) / 1000) * speedRef.current;
    startOffsetRef.current = startOffsetRef.current + elapsed;
    stateRef.current = 'paused';
    setPlaybackState('paused');
    instRef.current?.stop();
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    instRef.current?.stop();
    scheduledRef.current.clear();
    startOffsetRef.current = 0;
    stateRef.current = 'idle';
    setPlaybackState('idle');
    setCurrentTime(0);
  }, []);

  const setSpeed = useCallback((s: number) => {
    if (stateRef.current === 'playing') {
      const elapsed =
        ((performance.now() - startWallRef.current) / 1000) * speedRef.current;
      startOffsetRef.current = startOffsetRef.current + elapsed;
      startWallRef.current = performance.now();
    }
    speedRef.current = s;
    setSpeedState(s);
  }, []);

  const setInstrument = useCallback(
    (name: string) => {
      stop();
      setInstrumentState(name);
    },
    [stop],
  );

  const setVolume = useCallback((v: number) => {
    volumeRef.current = v;
    setVolumeState(v);
    instRef.current?.output.setVolume(v);
  }, []);

  const setReverbMix = useCallback((mix: number) => {
    reverbMixRef.current = mix;
    setReverbMixState(mix);
    instRef.current?.output.sendEffect('reverb', mix);
  }, []);

  const setHumanize = useCallback((on: boolean) => {
    humanizeRef.current = on;
    setHumanizeState(on);
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      instRef.current?.disconnect();
      ctxRef.current?.close();
    };
  }, []);

  return {
    playbackState,
    currentTime,
    speed,
    instrument,
    loading,
    volume,
    reverbMix,
    humanize,
    play,
    pause,
    stop,
    setSpeed,
    setInstrument,
    setVolume,
    setReverbMix,
    setHumanize,
  };
}
