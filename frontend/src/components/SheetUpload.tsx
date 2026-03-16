import { Button } from '@/components/ui/button';
import { useProcessing } from '@/contexts/ProcessingContext';
import gsap from 'gsap';
import { Loader2, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

export function SheetUpload() {
  const { startProcessing, cancel, status } = useProcessing();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' },
      );
    }
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      if (status === 'processing') {
        setError('A file is already being processed. Please wait.');
        return;
      }
      setError(null);
      startProcessing(file);
    },
    [startProcessing, status],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (inputRef.current) inputRef.current.value = '';
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
      <h2 className="text-lg font-medium text-white mb-1">
        Upload Sheet Music
      </h2>
      <p className="text-sm text-[#a1a1aa] mb-4">
        Upload an image or PDF to convert it into an interactive piano roll
      </p>

      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-white/10 bg-[#12152a] p-8 transition-colors hover:border-white/20 hover:bg-[#161936]"
      >
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
        <p className="text-xs text-[#a1a1aa]/50">PNG, JPG, TIFF, or PDF</p>

        {status === 'processing' && (
          <div className="mt-1 flex items-center gap-2">
            <p className="text-xs text-white/70 flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />A file is being
              processed in the background
            </p>
            <button
              type="button"
              onClick={cancel}
              className="text-xs text-white/70 hover:text-neutral-400 cursor-pointer transition-colors underline underline-offset-2"
            >
              Cancel
            </button>
          </div>
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
        <p className="mt-3 text-center text-sm text-neutral-400">{error}</p>
      )}
    </section>
  );
}
