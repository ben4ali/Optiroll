import { ControlSidebar, TransportOverlay } from '@/components/ControlBar';
import { PianoRoll } from '@/components/PianoRoll';
import { Button } from '@/components/ui/button';
import { usePianoPlayer } from '@/hooks/usePianoPlayer';
import { fetchSheet } from '@/lib/api';
import type { ColorScheme } from '@/lib/colors';
import { DEFAULT_COLOR_SCHEME } from '@/lib/colors';
import type { HitEffect, NoteData } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';

export function PlayerPage() {
  const { sheetId } = useParams<{ sheetId: string }>();
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [sheetName, setSheetName] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingSheet, setLoadingSheet] = useState(true);

  // Visual settings
  const [colorScheme, setColorScheme] =
    useState<ColorScheme>(DEFAULT_COLOR_SCHEME);
  const [hitEffect, setHitEffect] = useState<HitEffect>('glow');
  const [particleIntensity, setParticleIntensity] = useState(2);

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!sheetId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingSheet(true);
    setLoadError(null);

    fetchSheet(Number(sheetId))
      .then(detail => {
        if (cancelled) return;
        setNotes(detail.notes);
        setSheetName(detail.name || detail.filename);
      })
      .catch(err => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoadingSheet(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sheetId]);

  const player = usePianoPlayer(notes);

  const handleColorSchemeChange = useCallback((s: ColorScheme) => {
    setColorScheme(s);
  }, []);

  const handleHitEffectChange = useCallback((e: HitEffect) => {
    setHitEffect(e);
  }, []);

  const handleParticleIntensityChange = useCallback((v: number) => {
    setParticleIntensity(v);
  }, []);

  if (loadingSheet) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#3b82f6]/50" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-red-400">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Main area: PianoRoll + floating transport */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Sheet title */}
        {sheetName && (
          <div className="absolute top-3 left-4 z-10">
            <span className="text-xs font-medium text-white/50 bg-[#141735]/90 backdrop-blur-sm border border-white/10 px-3 py-1 rounded-md">
              {sheetName}
            </span>
          </div>
        )}

        {/* Settings button — visible when sidebar is closed */}
        {!sidebarOpen && (
          <div className="absolute top-3 right-4 z-10">
            <Button
              variant="ghost"
              size="icon"
              className="h-16 w-16 cursor-pointer scale-75 text-white/40 hover:text-white/70 hover:bg-white/[0.08] bg-[#141735]/90 backdrop-blur-sm border border-white/10 rounded-md"
              onClick={() => setSidebarOpen(true)}
            >
              <img src="/genie_logo.png" alt="Settings" className="h-12 w-12" />
            </Button>
          </div>
        )}

        {/* Piano Roll fills all space */}
        <div className="flex-1 min-h-0">
          <PianoRoll
            notes={notes}
            currentTime={player.currentTime}
            playing={player.playbackState === 'playing'}
            colorScheme={colorScheme}
            hitEffect={hitEffect}
            particleIntensity={particleIntensity}
            octave={player.octave}
            transpose={player.transpose}
          />
        </div>

        {/* Floating transport */}
        <TransportOverlay
          playbackState={player.playbackState}
          loading={player.loading}
          duetLoading={player.duetLoading}
          speed={player.speed}
          currentTime={player.currentTime}
          duration={player.duration}
          onPlay={player.play}
          onPause={player.pause}
          onStop={player.stop}
          onSpeedChange={player.setSpeed}
          onSeek={player.seek}
        />
      </div>

      {/* Right sidebar — absolutely positioned, overlays canvas */}
      <ControlSidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        instrument={player.instrument}
        volume={player.volume}
        reverbMix={player.reverbMix}
        humanize={player.humanize}
        octave={player.octave}
        transpose={player.transpose}
        colorScheme={colorScheme}
        hitEffect={hitEffect}
        particleIntensity={particleIntensity}
        duetEnabled={player.duetEnabled}
        duetInstrument={player.duetInstrument}
        duetVolume={player.duetVolume}
        duetOctave={player.duetOctave}
        duetLoading={player.duetLoading}
        onInstrumentChange={player.setInstrument}
        onVolumeChange={player.setVolume}
        onReverbMixChange={player.setReverbMix}
        onHumanizeChange={player.setHumanize}
        onOctaveChange={player.setOctave}
        onTransposeChange={player.setTranspose}
        onColorSchemeChange={handleColorSchemeChange}
        onHitEffectChange={handleHitEffectChange}
        onParticleIntensityChange={handleParticleIntensityChange}
        onDuetEnabledChange={player.setDuetEnabled}
        onDuetInstrumentChange={player.setDuetInstrument}
        onDuetVolumeChange={player.setDuetVolume}
        onDuetOctaveChange={player.setDuetOctave}
      />
    </div>
  );
}
