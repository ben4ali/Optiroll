import {
  ControlSidebar,
  TransportDocked,
  TransportOverlay,
} from '@/components/ControlBar';
import { PianoRollGL } from '@/components/PianoRollGL';
import { Button } from '@/components/ui/button';
import { usePianoPlayer } from '@/hooks/usePianoPlayer';
import { fetchSheet } from '@/lib/api';
import type { ColorScheme } from '@/lib/colors';
import { DEFAULT_COLOR_SCHEME } from '@/lib/colors';
import type { NoteData, WebGLHitEffect } from '@/lib/types';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useOutletContext, useParams } from 'react-router';

export function PlayerPage() {
  const { setNowPlayingTitle, registerStopPlayback } = useOutletContext<{
    nowPlayingTitle: string;
    setNowPlayingTitle: (title: string) => void;
    registerStopPlayback: (fn: (() => void) | null) => void;
  }>();
  const { sheetId } = useParams<{ sheetId: string }>();
  const location = useLocation();
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [sheetName, setSheetName] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingSheet, setLoadingSheet] = useState(true);

  // Visual settings
  const [colorScheme, setColorScheme] =
    useState<ColorScheme>(DEFAULT_COLOR_SCHEME);

  // WebGL visual settings
  const [hitEffect, setHitEffect] = useState<WebGLHitEffect>('nebula');
  const [bloomStrength, setBloomStrength] = useState(1.5);
  const [bloomRadius, setBloomRadius] = useState(0.4);
  const [showKeyDividers, setShowKeyDividers] = useState(false);

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Transport mode
  const [transportDocked, setTransportDocked] = useState(true);
  const resumeAfterSeekRef = useRef(false);

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

  useEffect(() => {
    setNowPlayingTitle(sheetName || '');
    return () => setNowPlayingTitle('');
  }, [setNowPlayingTitle, sheetName]);

  const player = usePianoPlayer(notes);
  const { stop } = player;

  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      stop();
      prevPathRef.current = location.pathname;
    }
  }, [location.pathname, stop]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  useEffect(() => {
    registerStopPlayback(stop);
    return () => registerStopPlayback(null);
  }, [registerStopPlayback, stop]);

  const handleColorSchemeChange = useCallback((s: ColorScheme) => {
    setColorScheme(s);
  }, []);

  const handleHitEffectChange = useCallback((e: WebGLHitEffect) => {
    setHitEffect(e);
  }, []);

  const handleBloomStrengthChange = useCallback((v: number) => {
    setBloomStrength(v);
  }, []);

  const handleBloomRadiusChange = useCallback((v: number) => {
    setBloomRadius(v);
  }, []);

  const handleShowKeyDividersChange = useCallback((v: boolean) => {
    setShowKeyDividers(v);
  }, []);

  const handleSeekStart = useCallback(() => {
    if (player.playbackState === 'playing') {
      resumeAfterSeekRef.current = true;
      player.pause();
    } else {
      resumeAfterSeekRef.current = false;
    }
  }, [player]);

  const handleSeekEnd = useCallback(() => {
    if (resumeAfterSeekRef.current) {
      player.play();
    }
    resumeAfterSeekRef.current = false;
  }, [player]);

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
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
      {/* Main area: PianoRoll + floating transport */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
        {/* Sheet title moved to navbar */}

        {/* Settings button — visible when sidebar is closed */}
        {!sidebarOpen && (
          <div className="absolute top-3 right-4 z-20">
            <Button
              variant="ghost"
              size="icon"
              className="cursor-pointer  text-white/80 hover:text-white/90 hover:bg-white/8 bg-[#141735]/90 backdrop-blur-sm border border-white/10 rounded-md"
              onClick={() => setSidebarOpen(true)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* WebGL Piano Roll fills all space */}
        <div className="flex-1 min-h-0">
          <PianoRollGL
            notes={notes}
            currentTime={player.currentTime}
            playing={player.playbackState === 'playing'}
            colorScheme={colorScheme}
            octave={player.octave}
            transpose={player.transpose}
            hitEffect={hitEffect}
            bloomStrength={bloomStrength}
            bloomRadius={bloomRadius}
            studioDarkness={0}
            showKeyDividers={showKeyDividers}
          />
        </div>

        {/* Floating transport */}
        {!transportDocked && (
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
            onSeekStart={handleSeekStart}
            onSeekEnd={handleSeekEnd}
            onToggleDock={() => setTransportDocked(true)}
          />
        )}
      </div>

      {/* Docked transport (under keyboard) */}
      {transportDocked && (
        <TransportDocked
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
          onSeekStart={handleSeekStart}
          onSeekEnd={handleSeekEnd}
          onToggleDock={() => setTransportDocked(false)}
        />
      )}

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
        bloomStrength={bloomStrength}
        bloomRadius={bloomRadius}
        showKeyDividers={showKeyDividers}
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
        onBloomStrengthChange={handleBloomStrengthChange}
        onBloomRadiusChange={handleBloomRadiusChange}
        onShowKeyDividersChange={handleShowKeyDividersChange}
        onDuetEnabledChange={player.setDuetEnabled}
        onDuetInstrumentChange={player.setDuetInstrument}
        onDuetVolumeChange={player.setDuetVolume}
        onDuetOctaveChange={player.setDuetOctave}
      />
    </div>
  );
}
