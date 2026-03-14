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
import type { PlaybackState } from '@/lib/types';
import { INSTRUMENT_CATEGORIES } from '@/lib/types';
import { Loader2, Pause, Play, Square, Volume2 } from 'lucide-react';
import { memo } from 'react';

interface ControlBarProps {
  playbackState: PlaybackState;
  speed: number;
  instrument: string;
  loading: boolean;
  volume: number;
  reverbMix: number;
  humanize: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSpeedChange: (speed: number) => void;
  onInstrumentChange: (name: string) => void;
  onVolumeChange: (vol: number) => void;
  onReverbMixChange: (mix: number) => void;
  onHumanizeChange: (on: boolean) => void;
}

export const ControlBar = memo(function ControlBar({
  playbackState,
  speed,
  instrument,
  loading,
  volume,
  reverbMix,
  humanize,
  onPlay,
  onPause,
  onStop,
  onSpeedChange,
  onInstrumentChange,
  onVolumeChange,
  onReverbMixChange,
  onHumanizeChange,
}: ControlBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-3">
      {/* Transport controls */}
      <div className="flex items-center gap-1">
        {playbackState === 'playing' ? (
          <Button variant="ghost" size="icon" onClick={onPause}>
            <Pause className="h-5 w-5" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={onPlay}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onStop}
          disabled={playbackState === 'idle'}
        >
          <Square className="h-4 w-4" />
        </Button>
      </div>

      {/* Speed slider */}
      <div className="flex items-center gap-2 min-w-[160px]">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          Speed
        </span>
        <Slider
          min={0.25}
          max={2}
          step={0.05}
          value={[speed]}
          onValueChange={([v]) => onSpeedChange(v)}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">
          {speed.toFixed(2)}x
        </span>
      </div>

      {/* Volume slider */}
      <div className="flex items-center gap-2 min-w-[120px]">
        <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <Slider
          min={0}
          max={127}
          step={1}
          value={[volume]}
          onValueChange={([v]) => onVolumeChange(v)}
          className="flex-1"
        />
      </div>

      {/* Reverb slider */}
      <div className="flex items-center gap-2 min-w-[130px]">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          Reverb
        </span>
        <Slider
          min={0}
          max={1}
          step={0.05}
          value={[reverbMix]}
          onValueChange={([v]) => onReverbMixChange(v)}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">
          {Math.round(reverbMix * 100)}%
        </span>
      </div>

      {/* Humanize toggle */}
      <Button
        variant={humanize ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => onHumanizeChange(!humanize)}
        className="text-xs"
      >
        Humanize
      </Button>

      {/* Instrument selector */}
      <div className="flex items-center gap-2">
        <Select value={instrument} onValueChange={onInstrumentChange}>
          <SelectTrigger className="w-[220px]">
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
      </div>
    </div>
  );
});
