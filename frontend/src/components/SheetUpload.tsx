import { Button } from '@/components/ui/button';
import { processSheetWithProgress } from '@/lib/api';
import type { SSEEvent } from '@/lib/types';
import gsap from 'gsap';
import { ChevronDown, ChevronUp, Loader2, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface SheetUploadProps {
  onProcessed: (sheetId: number) => void;
}

export function SheetUpload({ onProcessed }: SheetUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Card entrance animation
  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' },
      );
    }
  }, []);

  const handleEvent = useCallback((event: SSEEvent) => {
    setProgress(event.progress);
    if (event.type === 'log') {
      setLogs(prev => [...prev, event.message]);
      setTimeout(
        () => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }),
        50,
      );
    }
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setFileName(file.name);
      setUploading(true);
      setProgress(0);
      setLogs([]);
      setLogsOpen(false);
      try {
        const { sheetId } = await processSheetWithProgress(file, handleEvent);
        onProcessed(sheetId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setUploading(false);
      }
    },
    [onProcessed, handleEvent],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <section ref={cardRef} className="rounded-xl bg-[#181b2e] p-5">
      <h2 className="text-lg font-semibold text-white mb-1">Upload Sheet Music</h2>
      <p className="text-sm text-[#a1a1aa] mb-4">
        Upload an image or PDF to convert it into an interactive piano roll
      </p>

      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-white/10 bg-[#12152a] p-8 transition-colors hover:border-white/20 hover:bg-[#161936]"
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-4 w-full">
            <Loader2 className="h-8 w-8 animate-spin text-[#3b82f6]/60" />
            <p className="text-sm text-[#a1a1aa]">
              Processing{' '}
              <span className="font-medium text-white">{fileName}</span>
            </p>

            {/* Progress bar */}
            <div className="w-full max-w-sm">
              <div className="flex justify-between text-xs text-[#a1a1aa] mb-1">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#3b82f6] transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Expandable logs */}
            <div className="w-full max-w-sm">
              <button
                type="button"
                onClick={() => setLogsOpen(o => !o)}
                className="flex items-center gap-1 text-xs text-[#a1a1aa] hover:text-white/70 transition-colors"
              >
                {logsOpen ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                {logsOpen ? 'Hide' : 'Show'} logs ({logs.length} lines)
              </button>
              {logsOpen && (
                <div className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-[#0c0e1f] border border-white/5 p-2 font-mono text-[11px] leading-relaxed text-[#a1a1aa]">
                  {logs.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <Upload className="h-8 w-8 text-white/15" />
            <div className="text-center">
              <p className="text-sm text-[#a1a1aa]">
                Drag &amp; drop a file here, or
              </p>
              <Button
                variant="outline"
                className="mt-3 border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.1] hover:border-white/20"
                onClick={() => inputRef.current?.click()}
              >
                Browse Files
              </Button>
            </div>
            <p className="text-xs text-[#a1a1aa]/50">
              PNG, JPG, TIFF, or PDF
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf,application/pdf"
          className="hidden"
          onChange={handleChange}
        />
      </div>
      {error && (
        <p className="mt-3 text-center text-sm text-red-400">{error}</p>
      )}
    </section>
  );
}
