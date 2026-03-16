import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import type { ColorScheme } from '@/lib/colors';
import { COLOR_SCHEMES } from '@/lib/colors';
import type { PlaybackState, WebGLHitEffect } from '@/lib/types';
import { INSTRUMENT_CATEGORIES } from '@/lib/types';
import gsap from 'gsap';
import {
  ChevronRight,
  Loader2,
  Pause,
  Play,
  Square,
  Volume2,
} from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

// ── Props ──

interface ControlBarProps {
  playbackState: PlaybackState;
  speed: number;
  instrument: string;
  loading: boolean;
  volume: number;
  reverbMix: number;
  humanize: boolean;
  octave: number;
  transpose: number;
  colorScheme: ColorScheme;
  hitEffect: WebGLHitEffect;
  bloomStrength: number;
  bloomRadius: number;
  showKeyDividers: boolean;
  // Duet
  duetEnabled: boolean;
  duetInstrument: string;
  duetVolume: number;
  duetOctave: number;
  duetLoading: boolean;
  // Actions
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSpeedChange: (speed: number) => void;
  onInstrumentChange: (name: string) => void;
  onVolumeChange: (vol: number) => void;
  onReverbMixChange: (mix: number) => void;
  onHumanizeChange: (on: boolean) => void;
  onOctaveChange: (octave: number) => void;
  onTransposeChange: (transpose: number) => void;
  onColorSchemeChange: (scheme: ColorScheme) => void;
  onHitEffectChange: (effect: WebGLHitEffect) => void;
  onBloomStrengthChange: (v: number) => void;
  onBloomRadiusChange: (v: number) => void;
  onShowKeyDividersChange: (on: boolean) => void;
  onDuetEnabledChange: (on: boolean) => void;
  onDuetInstrumentChange: (name: string) => void;
  onDuetVolumeChange: (vol: number) => void;
  onDuetOctaveChange: (octave: number) => void;
}

// ── Shared constants ──

const HIT_EFFECTS: { label: string; value: WebGLHitEffect }[] = [
  { label: 'Nebula Swirl', value: 'nebula' },
  { label: 'Shockwave', value: 'shockwave' },
  { label: 'Energy Spark', value: 'spark' },
  { label: 'Stardust', value: 'stardust' },
  { label: 'Nova Burst', value: 'nova' },
  { label: 'Rift Drift', value: 'rift' },
];

const OCTAVE_OPTIONS = [
  { label: '-2 Oct', value: -2 },
  { label: '-1 Oct', value: -1 },
  { label: 'Same', value: 0 },
  { label: '+1 Oct', value: 1 },
  { label: '+2 Oct', value: 2 },
];

// ── Small helpers ──

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#7a7f9d]/60 mb-3">
      {children}
    </h3>
  );
}

function ControlRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 mb-2.5">
      <span className="text-xs text-[#7a7f9d] w-16 shrink-0">{label}</span>
      <div className="flex-1 flex items-center gap-2">{children}</div>
    </div>
  );
}

function InstrumentSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full border-white/10 bg-[#1e2345]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {INSTRUMENT_CATEGORIES.map(category => (
          <SelectGroup key={category.label}>
            <SelectLabel>{category.label}</SelectLabel>
            {category.instruments.map(inst => (
              <SelectItem key={inst.value} value={inst.value}>
                {inst.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── Helper: format seconds as m:ss ──

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function SeekBar({
  currentTime,
  duration,
  onSeek,
}: {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const pct =
    duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

  const seekAt = useCallback(
    (clientX: number) => {
      const el = barRef.current;
      if (!el || duration <= 0) return;
      const rect = el.getBoundingClientRect();
      const x = Math.min(rect.right, Math.max(rect.left, clientX));
      const p = (x - rect.left) / rect.width;
      onSeek(p * duration);
    },
    [duration, onSeek],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      isDragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      seekAt(e.clientX);
    },
    [seekAt],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      seekAt(e.clientX);
    },
    [seekAt],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  return (
    <div
      ref={barRef}
      data-seek-bar
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="relative h-2 w-full rounded-full bg-white/10 cursor-pointer"
    >
      <div
        className="absolute left-0 top-0 h-full rounded-full bg-white"
        style={{ width: `${pct * 100}%` }}
      />
      <div
        className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-white shadow-sm"
        style={{ left: `calc(${pct * 100}% - 5px)` }}
      />
    </div>
  );
}

// ── Draggable transport overlay (bottom-left by default) ──

export const TransportOverlay = memo(function TransportOverlay({
  playbackState,
  loading,
  duetLoading,
  speed,
  currentTime,
  duration,
  onPlay,
  onPause,
  onStop,
  onSpeedChange,
  onSeek,
}: {
  playbackState: PlaybackState;
  loading: boolean;
  duetLoading: boolean;
  speed: number;
  currentTime: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSpeedChange: (s: number) => void;
  onSeek: (time: number) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    startX: number;
    startY: number;
    ox: number;
    oy: number;
    dragging: boolean;
  }>({
    startX: 0,
    startY: 0,
    ox: 0,
    oy: 0,
    dragging: false,
  });
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Entrance animation
  useEffect(() => {
    if (barRef.current) {
      gsap.fromTo(
        barRef.current,
        { x: -30, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.5, ease: 'power3.out' },
      );
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const tag = (e.target as HTMLElement).closest(
        'button, [role="slider"], input, [data-seek-bar]',
      );
      if (tag) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        ox: offset.x,
        oy: offset.y,
        dragging: false,
      };
    },
    [offset],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const s = dragState.current;
    if (s.startX === 0 && s.startY === 0) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (!s.dragging && Math.abs(dx) + Math.abs(dy) > 4) s.dragging = true;
    if (s.dragging) {
      setOffset({ x: s.ox + dx, y: s.oy + dy });
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    dragState.current = {
      startX: 0,
      startY: 0,
      ox: 0,
      oy: 0,
      dragging: false,
    };
  }, []);

  return (
    <div
      ref={barRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="absolute bottom-[220px] left-4 flex flex-col gap-2 rounded-2xl border border-white/10 bg-[#141735]/55 backdrop-blur-md px-5 py-3 shadow-lg shadow-black/30 cursor-grab z-10 active:cursor-grabbing select-none touch-none"
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px)`,
      }}
    >
      {/* Top row: Play/Pause, Stop, divider, Speed */}
      <div className="flex items-center gap-3">
        {/* Play/Pause */}
        {playbackState === 'playing' ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/[0.08]"
            onClick={onPause}
          >
            <Pause className="h-5 w-5" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/[0.08]"
            onClick={onPlay}
            disabled={loading || duetLoading}
          >
            {loading || duetLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </Button>
        )}

        {/* Stop */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/[0.08]"
          onClick={onStop}
          disabled={playbackState === 'idle'}
        >
          <Square className="h-4 w-4" />
        </Button>

        {/* Divider */}
        <div className="h-5 w-px bg-white/10" />

        {/* Speed */}
        <div className="flex items-center gap-2 min-w-[120px]">
          <Slider
            min={0.25}
            max={2}
            step={0.05}
            value={[speed]}
            onValueChange={([v]) => onSpeedChange(v)}
            className="flex-1"
          />
          <span className="text-xs text-[#7a7f9d] w-9 text-right tabular-nums">
            {speed.toFixed(2)}x
          </span>
        </div>
      </div>

      {/* Seek bar */}
      {duration > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#7a7f9d] w-8 text-right tabular-nums shrink-0">
            {formatTime(currentTime)}
          </span>
          <div className="flex-1">
            <SeekBar
              currentTime={currentTime}
              duration={duration}
              onSeek={onSeek}
            />
          </div>
          <span className="text-[10px] text-[#7a7f9d] w-8 tabular-nums shrink-0">
            {formatTime(duration)}
          </span>
        </div>
      )}
    </div>
  );
});

// ── Sidebar (GSAP animated, open by default, toggle button inside header) ──

const SIDEBAR_W = 288;

export const ControlSidebar = memo(function ControlSidebar({
  open,
  onToggle,
  instrument,
  volume,
  reverbMix,
  humanize,
  octave,
  transpose,
  colorScheme,
  hitEffect,
  bloomStrength,
  bloomRadius,
  showKeyDividers,
  duetEnabled,
  duetInstrument,
  duetVolume,
  duetOctave,
  duetLoading,
  onInstrumentChange,
  onVolumeChange,
  onReverbMixChange,
  onHumanizeChange,
  onOctaveChange,
  onTransposeChange,
  onColorSchemeChange,
  onHitEffectChange,
  onBloomStrengthChange,
  onBloomRadiusChange,
  onShowKeyDividersChange,
  onDuetEnabledChange,
  onDuetInstrumentChange,
  onDuetVolumeChange,
  onDuetOctaveChange,
}: Omit<
  ControlBarProps,
  | 'playbackState'
  | 'speed'
  | 'loading'
  | 'onPlay'
  | 'onPause'
  | 'onStop'
  | 'onSpeedChange'
> & { open: boolean; onToggle: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (open) {
        // Animate open on first mount
        gsap.fromTo(
          el,
          { x: SIDEBAR_W, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out' },
        );
      } else {
        gsap.set(el, { x: SIDEBAR_W });
      }
      return;
    }

    if (open) {
      gsap.to(el, {
        x: 0,
        duration: 0.4,
        ease: 'power3.out',
      });
    } else {
      gsap.to(el, {
        x: SIDEBAR_W,
        duration: 0.35,
        ease: 'power3.in',
      });
    }
  }, [open]);

  return (
    <div
      ref={panelRef}
      className="absolute top-0 right-0 h-full border-l border-white/10 bg-[#141735] flex flex-col overflow-hidden z-20"
      style={{ width: SIDEBAR_W }}
    >
      {/* Header with integrated toggle */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <div className="flex gap-2 items-center">
          <img src="/genie_logo.png" alt="Logo" className="h-6 w-6" />
          <span className="text-sm font-medium text-white/80">Controls</span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-white/30 hover:text-white/60 hover:bg-white/[0.08]"
          onClick={onToggle}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* ── KEYBOARD SECTION ── */}
        <SectionHeader>Keyboard</SectionHeader>

        <div className="mb-2.5">
          <span className="text-xs text-[#7a7f9d] block mb-1.5">
            Instrument
          </span>
          <InstrumentSelect value={instrument} onChange={onInstrumentChange} />
        </div>

        <ControlRow label="Volume">
          <Volume2 className="h-3.5 w-3.5 text-[#7a7f9d] shrink-0" />
          <Slider
            min={0}
            max={127}
            step={1}
            value={[volume]}
            onValueChange={([v]) => onVolumeChange(v)}
            className="flex-1"
          />
        </ControlRow>

        <ControlRow label="Reverb">
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={[reverbMix]}
            onValueChange={([v]) => onReverbMixChange(v)}
            className="flex-1"
          />
          <span className="text-xs text-[#7a7f9d] w-7 text-right tabular-nums">
            {Math.round(reverbMix * 100)}%
          </span>
        </ControlRow>

        <ControlRow label="Octave">
          <Select
            value={String(octave)}
            onValueChange={v => onOctaveChange(Number(v))}
          >
            <SelectTrigger className="w-full border-white/10 bg-[#1e2345]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OCTAVE_OPTIONS.map(o => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ControlRow>

        <ControlRow label="Transpose">
          <Slider
            min={-12}
            max={12}
            step={1}
            value={[transpose]}
            onValueChange={([v]) => onTransposeChange(v)}
            className="flex-1"
          />
          <span className="text-xs text-[#7a7f9d] w-7 text-right tabular-nums">
            {transpose > 0 ? `+${transpose}` : transpose}
          </span>
        </ControlRow>

        <div className="mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onHumanizeChange(!humanize)}
            className={`text-xs w-full border-white/10 ${humanize ? 'bg-[#232850] border-[#3b82f6]/30 text-[#60a5fa]' : 'bg-[#1e2345] text-[#7a7f9d]'}`}
          >
            Humanize {humanize ? 'On' : 'Off'}
          </Button>
        </div>

        {/* ── DUET SECTION ── */}
        <div className="border-t border-white/10 pt-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader>Duet</SectionHeader>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDuetEnabledChange(!duetEnabled)}
              className={`text-xs h-6 px-2 border-white/10 ${duetEnabled ? 'bg-[#232850] border-[#3b82f6]/30 text-[#60a5fa]' : 'bg-[#1e2345] text-[#7a7f9d]'}`}
            >
              {duetEnabled ? 'On' : 'Off'}
            </Button>
          </div>

          {duetEnabled && (
            <>
              <div className="mb-2.5">
                <span className="text-xs text-[#7a7f9d] block mb-1.5">
                  Instrument
                  {duetLoading && (
                    <Loader2 className="inline h-3 w-3 animate-spin ml-1" />
                  )}
                </span>
                <InstrumentSelect
                  value={duetInstrument}
                  onChange={onDuetInstrumentChange}
                />
              </div>

              <ControlRow label="Volume">
                <Volume2 className="h-3.5 w-3.5 text-[#7a7f9d] shrink-0" />
                <Slider
                  min={0}
                  max={127}
                  step={1}
                  value={[duetVolume]}
                  onValueChange={([v]) => onDuetVolumeChange(v)}
                  className="flex-1"
                />
              </ControlRow>

              <ControlRow label="Octave">
                <Select
                  value={String(duetOctave)}
                  onValueChange={v => onDuetOctaveChange(Number(v))}
                >
                  <SelectTrigger className="w-full border-white/10 bg-[#1e2345]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OCTAVE_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ControlRow>
            </>
          )}
        </div>

        {/* ── VISUALS SECTION ── */}
        <div className="border-t border-white/10 pt-4">
          <SectionHeader>Visuals</SectionHeader>

          <div className="mb-2.5">
            <span className="text-xs text-[#7a7f9d] block mb-1.5">
              Color Scheme
            </span>
            <Select
              value={colorScheme.value}
              onValueChange={v => {
                const s = COLOR_SCHEMES.find(c => c.value === v);
                if (s) onColorSchemeChange(s);
              }}
            >
              <SelectTrigger className="w-full border-white/10 bg-[#1e2345]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLOR_SCHEMES.map(s => (
                  <SelectItem key={s.value} value={s.value}>
                    <span className="flex items-center gap-2">
                      <span className="flex gap-0.5">
                        {s.colors.slice(0, 6).map((c, idx) => (
                          <span
                            key={idx}
                            className="inline-block h-2.5 w-2.5 rounded-sm"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </span>
                      {s.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mb-2.5">
            <span className="text-xs text-[#7a7f9d] block mb-1.5">
              Impact Effect
            </span>
            <Select
              value={hitEffect}
              onValueChange={v => onHitEffectChange(v as WebGLHitEffect)}
            >
              <SelectTrigger className="w-full border-white/10 bg-[#1e2345]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HIT_EFFECTS.map(e => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ControlRow label="Glow">
            <Slider
              min={0}
              max={3}
              step={0.1}
              value={[bloomStrength]}
              onValueChange={([v]) => onBloomStrengthChange(v)}
              className="flex-1"
            />
            <span className="text-xs text-[#7a7f9d] w-7 text-right tabular-nums">
              {bloomStrength.toFixed(1)}
            </span>
          </ControlRow>

          <ControlRow label="Spread">
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[bloomRadius]}
              onValueChange={([v]) => onBloomRadiusChange(v)}
              className="flex-1"
            />
            <span className="text-xs text-[#7a7f9d] w-7 text-right tabular-nums">
              {bloomRadius.toFixed(2)}
            </span>
          </ControlRow>

          <ControlRow label="Key Lines">
            <label className="flex items-center gap-2 text-xs text-[#7a7f9d]">
              <input
                type="checkbox"
                className="app-checkbox"
                checked={showKeyDividers}
                onChange={e => onShowKeyDividersChange(e.target.checked)}
              />
              Show dividers
            </label>
          </ControlRow>
        </div>
      </div>
    </div>
  );
});
