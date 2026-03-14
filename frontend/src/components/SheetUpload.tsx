import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { processSheetWithProgress } from '@/lib/api';
import type { SSEEvent } from '@/lib/types';
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Music,
  Upload,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

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
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Music className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-xl">Upload Sheet Music</CardTitle>
        <CardDescription>
          Upload an image of sheet music to convert it into an interactive piano
          roll
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary/50 hover:bg-accent/30"
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-4 w-full">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Processing <span className="font-medium">{fileName}</span>
              </p>

              {/* Progress bar */}
              <div className="w-full">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Expandable logs */}
              <div className="w-full">
                <button
                  type="button"
                  onClick={() => setLogsOpen(o => !o)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {logsOpen ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  {logsOpen ? 'Hide' : 'Show'} logs ({logs.length} lines)
                </button>
                {logsOpen && (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded bg-background border border-border p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
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
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Drag &amp; drop an image here, or
                </p>
                <Button
                  variant="secondary"
                  className="mt-2"
                  onClick={() => inputRef.current?.click()}
                >
                  Browse Files
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                PNG, JPG, or TIFF up to 10 MB
              </p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleChange}
          />
        </div>
        {error && (
          <p className="mt-3 text-center text-sm text-destructive-foreground">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
