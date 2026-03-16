import type { NoteData, PlaybackState } from '@/lib/types';
import { ALL_INSTRUMENTS, DEFAULT_INSTRUMENT } from '@/lib/types';
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
  duration: number;
  speed: number;
  instrument: string;
  loading: boolean;
  volume: number;
  reverbMix: number;
  humanize: boolean;
  octave: number;
  transpose: number;
  // Duet
  duetEnabled: boolean;
  duetInstrument: string;
  duetVolume: number;
  duetOctave: number;
  duetLoading: boolean;
  // Actions
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setSpeed: (s: number) => void;
  setInstrument: (name: string) => void;
  setVolume: (v: number) => void;
  setReverbMix: (mix: number) => void;
  setHumanize: (on: boolean) => void;
  setOctave: (o: number) => void;
  setTranspose: (t: number) => void;
  setDuetEnabled: (on: boolean) => void;
  setDuetInstrument: (name: string) => void;
  setDuetVolume: (v: number) => void;
  setDuetOctave: (o: number) => void;
}

function createInstrument(
  ctx: AudioContext,
  name: string,
): AnyInstrument | null {
  const option = ALL_INSTRUMENTS.find(i => i.value === name);
  if (!option) return null;

  switch (option.type) {
    case 'splendid':
      return new SplendidGrandPiano(ctx) as unknown as AnyInstrument;
    case 'electric':
      return new ElectricPiano(ctx, {
        instrument: option.epName!,
      }) as unknown as AnyInstrument;
    case 'mellotron':
      return new Mellotron(ctx, {
        instrument: option.mellotronName!,
      }) as unknown as AnyInstrument;
    case 'soundfont':
    default:
      return new Soundfont(ctx, {
        instrument: option.sfName ?? name,
      }) as unknown as AnyInstrument;
  }
}

export function usePianoPlayer(notes: NoteData[]): UsePianoPlayerReturn {
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeedState] = useState(1);
  const [instrument, setInstrumentState] = useState(DEFAULT_INSTRUMENT);
  const [loading, setLoading] = useState(false);
  const [volume, setVolumeState] = useState(38);
  const [reverbMix, setReverbMixState] = useState(0.2);
  const [humanize, setHumanizeState] = useState(false);
  const [octave, setOctaveState] = useState(0);
  const [transpose, setTransposeState] = useState(0);

  // Duet state
  const [duetEnabled, setDuetEnabledState] = useState(false);
  const [duetInstrument, setDuetInstrumentState] = useState(
    'acoustic_grand_piano',
  );
  const [duetVolume, setDuetVolumeState] = useState(80);
  const [duetOctave, setDuetOctaveState] = useState(-1);
  const [duetLoading, setDuetLoading] = useState(false);

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
  const octaveRef = useRef(octave);
  const transposeRef = useRef(transpose);

  // Duet refs
  const duetInstRef = useRef<AnyInstrument | null>(null);
  const duetEnabledRef = useRef(duetEnabled);
  const duetInstrumentRef = useRef(duetInstrument);
  const duetVolumeRef = useRef(duetVolume);
  const duetOctaveRef = useRef(duetOctave);

  notesRef.current = notes;
  instrumentRef.current = instrument;
  duetEnabledRef.current = duetEnabled;
  duetInstrumentRef.current = duetInstrument;

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const totalDuration = notes.reduce(
    (max, n) => Math.max(max, n.start + n.duration),
    0,
  );
  const totalDurationRef = useRef(totalDuration);
  totalDurationRef.current = totalDuration;

  const ensureAudioContext = useCallback(async () => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === 'suspended') {
      await ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const ensureReverb = useCallback(async (ctx: AudioContext) => {
    if (!reverbRef.current) {
      reverbRef.current = new Reverb(ctx);
      await reverbRef.current.ready();
    }
    return reverbRef.current;
  }, []);

  const loadInstrument = useCallback(
    async (name: string) => {
      setLoading(true);
      try {
        const ctx = await ensureAudioContext();
        if (ctx.state === 'suspended') return;

        instRef.current?.disconnect();
        instRef.current = null;

        const inst = createInstrument(ctx, name);
        if (!inst) return;

        await inst.load;
        inst.output.setVolume(volumeRef.current);

        const reverb = await ensureReverb(ctx);
        inst.output.addEffect('reverb', reverb, reverbMixRef.current);

        instRef.current = inst;
      } finally {
        setLoading(false);
      }
    },
    [ensureAudioContext, ensureReverb],
  );

  const loadDuetInstrument = useCallback(
    async (name: string) => {
      setDuetLoading(true);
      try {
        const ctx = await ensureAudioContext();
        if (ctx.state === 'suspended') return;

        duetInstRef.current?.disconnect();
        duetInstRef.current = null;

        const inst = createInstrument(ctx, name);
        if (!inst) return;

        await inst.load;
        inst.output.setVolume(duetVolumeRef.current);

        const reverb = await ensureReverb(ctx);
        inst.output.addEffect('reverb', reverb, reverbMixRef.current);

        duetInstRef.current = inst;
      } finally {
        setDuetLoading(false);
      }
    },
    [ensureAudioContext, ensureReverb],
  );

  // Reload main instrument when user changes it
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

  // Reload duet instrument when user changes it or enables duet
  const prevDuetInstrumentRef = useRef(duetInstrument);
  const prevDuetEnabledRef = useRef(duetEnabled);
  useEffect(() => {
    const instrumentChanged = duetInstrument !== prevDuetInstrumentRef.current;
    const justEnabled = duetEnabled && !prevDuetEnabledRef.current;
    prevDuetInstrumentRef.current = duetInstrument;
    prevDuetEnabledRef.current = duetEnabled;

    if (!duetEnabled) {
      if (duetInstRef.current) {
        duetInstRef.current.disconnect();
        duetInstRef.current = null;
      }
      return;
    }

    if ((instrumentChanged || justEnabled) && ctxRef.current) {
      loadDuetInstrument(duetInstrument);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duetInstrument, duetEnabled]);

  // Animation / scheduling loop
  const tick = useCallback(() => {
    if (stateRef.current !== 'playing') return;

    const elapsed =
      ((performance.now() - startWallRef.current) / 1000) * speedRef.current;
    const t = startOffsetRef.current + elapsed;

    setCurrentTime(t);

    const inst = instRef.current;
    const duetInst = duetInstRef.current;
    const ctx = ctxRef.current;
    const currentNotes = notesRef.current;
    if (inst && ctx) {
      for (let i = 0; i < currentNotes.length; i++) {
        if (scheduledRef.current.has(i)) continue;
        const note = currentNotes[i];
        if (note.start <= t + LOOK_AHEAD_S && note.start + note.duration >= t) {
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

          const mainPitch =
            note.pitch + octaveRef.current * 12 + transposeRef.current;
          if (mainPitch >= 21 && mainPitch <= 108) {
            inst.start({
              note: mainPitch,
              velocity,
              time: acTime,
              duration: note.duration / speedRef.current,
              detune,
            });
          }

          // Duet: play the same note shifted by octave
          if (duetEnabledRef.current && duetInst) {
            const duetPitch =
              note.pitch + duetOctaveRef.current * 12 + transposeRef.current;
            if (duetPitch >= 21 && duetPitch <= 108) {
              duetInst.start({
                note: duetPitch,
                velocity: Math.max(1, Math.min(127, velocity - 10)),
                time: acTime,
                duration: note.duration / speedRef.current,
                detune,
              });
            }
          }
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

    if (!instRef.current) {
      await loadInstrument(instrumentRef.current);
    }
    if (duetEnabledRef.current && !duetInstRef.current) {
      await loadDuetInstrument(duetInstrumentRef.current);
    }

    if (stateRef.current === 'idle') {
      scheduledRef.current.clear();
      startOffsetRef.current = 0;
    }

    startWallRef.current = performance.now();
    stateRef.current = 'playing';
    setPlaybackState('playing');
    rafRef.current = requestAnimationFrame(tick);
  }, [ensureAudioContext, loadInstrument, loadDuetInstrument, tick]);

  const pause = useCallback(() => {
    if (stateRef.current !== 'playing') return;
    cancelAnimationFrame(rafRef.current);
    const elapsed =
      ((performance.now() - startWallRef.current) / 1000) * speedRef.current;
    startOffsetRef.current = startOffsetRef.current + elapsed;
    stateRef.current = 'paused';
    setPlaybackState('paused');
    instRef.current?.stop();
    duetInstRef.current?.stop();
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    instRef.current?.stop();
    duetInstRef.current?.stop();
    scheduledRef.current.clear();
    startOffsetRef.current = 0;
    stateRef.current = 'idle';
    setPlaybackState('idle');
    setCurrentTime(0);
  }, []);

  const seek = useCallback((time: number) => {
    const clamped = Math.max(0, Math.min(time, totalDurationRef.current));
    instRef.current?.stop();
    duetInstRef.current?.stop();
    scheduledRef.current.clear();
    startOffsetRef.current = clamped;
    setCurrentTime(clamped);

    if (stateRef.current === 'playing') {
      startWallRef.current = performance.now();
    }
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
    duetInstRef.current?.output.sendEffect('reverb', mix);
  }, []);

  const setHumanize = useCallback((on: boolean) => {
    humanizeRef.current = on;
    setHumanizeState(on);
  }, []);

  const setOctave = useCallback((o: number) => {
    octaveRef.current = o;
    setOctaveState(o);
  }, []);

  const setTranspose = useCallback((t: number) => {
    transposeRef.current = t;
    setTransposeState(t);
  }, []);

  const setDuetEnabled = useCallback((on: boolean) => {
    duetEnabledRef.current = on;
    setDuetEnabledState(on);
  }, []);

  const setDuetInstrument = useCallback(
    (name: string) => {
      stop();
      setDuetInstrumentState(name);
    },
    [stop],
  );

  const setDuetVolume = useCallback((v: number) => {
    duetVolumeRef.current = v;
    setDuetVolumeState(v);
    duetInstRef.current?.output.setVolume(v);
  }, []);

  const setDuetOctave = useCallback((o: number) => {
    duetOctaveRef.current = o;
    setDuetOctaveState(o);
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      instRef.current?.disconnect();
      duetInstRef.current?.disconnect();
      ctxRef.current?.close();
    };
  }, []);

  return {
    playbackState,
    currentTime,
    duration: totalDuration,
    speed,
    instrument,
    loading,
    volume,
    reverbMix,
    humanize,
    octave,
    transpose,
    duetEnabled,
    duetInstrument,
    duetVolume,
    duetOctave,
    duetLoading,
    play,
    pause,
    stop,
    seek,
    setSpeed,
    setInstrument,
    setVolume,
    setReverbMix,
    setHumanize,
    setOctave,
    setTranspose,
    setDuetEnabled,
    setDuetInstrument,
    setDuetVolume,
    setDuetOctave,
  };
}
