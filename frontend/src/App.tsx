import { ControlBar } from '@/components/ControlBar';
import { PianoRoll } from '@/components/PianoRoll';
import { SheetLibrary } from '@/components/SheetLibrary';
import { SheetUpload } from '@/components/SheetUpload';
import { usePianoPlayer } from '@/hooks/usePianoPlayer';
import type { NoteData } from '@/lib/types';
import { ArrowLeft } from 'lucide-react';
import { useCallback, useState } from 'react';

export default function App() {
  const [notes, setNotes] = useState<NoteData[]>([]);
  const player = usePianoPlayer(notes);

  const handleNotesLoaded = useCallback(
    (data: NoteData[]) => {
      player.stop();
      setNotes(data);
    },
    [player.stop],
  );

  const handleBack = useCallback(() => {
    player.stop();
    setNotes([]);
  }, [player.stop]);

  const hasNotes = notes.length > 0;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          {hasNotes && (
            <button
              onClick={handleBack}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          )}
          <h1 className="text-lg font-semibold tracking-tight">
            Piano Vision
          </h1>
        </div>
        {hasNotes && (
          <span className="text-xs text-muted-foreground">
            {notes.length} notes loaded
          </span>
        )}
      </header>

      {/* Main content */}
      {!hasNotes ? (
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="flex flex-col gap-6 w-full max-w-lg">
            <SheetUpload onNotesLoaded={handleNotesLoaded} />
            <SheetLibrary onNotesLoaded={handleNotesLoaded} />
          </div>
        </main>
      ) : (
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Piano roll canvas */}
          <div className="flex-1 min-h-0 p-2">
            <PianoRoll
              notes={notes}
              currentTime={player.currentTime}
              playing={player.playbackState === 'playing'}
            />
          </div>

          {/* Control bar */}
          <div className="border-t border-border p-3">
            <ControlBar
              playbackState={player.playbackState}
              speed={player.speed}
              instrument={player.instrument}
              loading={player.loading}
              volume={player.volume}
              reverbMix={player.reverbMix}
              humanize={player.humanize}
              onPlay={player.play}
              onPause={player.pause}
              onStop={player.stop}
              onSpeedChange={player.setSpeed}
              onInstrumentChange={player.setInstrument}
              onVolumeChange={player.setVolume}
              onReverbMixChange={player.setReverbMix}
              onHumanizeChange={player.setHumanize}
            />
          </div>
        </main>
      )}
    </div>
  );
}
