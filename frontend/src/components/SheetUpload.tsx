import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useProcessing } from '@/contexts/ProcessingContext';
import type { ProcessingPreset, ProcessingSettings } from '@/lib/types';
import gsap from 'gsap';
import { Loader2, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

export function SheetUpload() {
  const { startProcessing, cancel, status, progress, previewUrl, previewType } =
    useProcessing();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<ProcessingSettings>({
    preset: 'balanced',
    pdfRenderDpi: 110,
    pdfMinDpi: 90,
    maxImagePixels: 1800000,
    inferenceBatchSize: 16,
  });

  const presets: Record<
    ProcessingPreset,
    Omit<ProcessingSettings, 'preset'>
  > = {
    fast: {
      pdfRenderDpi: 96,
      pdfMinDpi: 72,
      maxImagePixels: 1200000,
      inferenceBatchSize: 24,
    },
    balanced: {
      pdfRenderDpi: 110,
      pdfMinDpi: 90,
      maxImagePixels: 1800000,
      inferenceBatchSize: 16,
    },
    accuracy: {
      pdfRenderDpi: 150,
      pdfMinDpi: 120,
      maxImagePixels: 2600000,
      inferenceBatchSize: 12,
    },
  };

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
      startProcessing(file, settings);
    },
    [settings, startProcessing, status],
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

      <div className="flex w-full justify-between items-start">
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          className="relative flex items-center justify-center rounded-lg border border-dashed border-white/10 bg-[#12152a] transition-colors hover:border-white/20 hover:bg-[#161936] w-[20rem] h-[21rem]"
        >
          {previewUrl ? (
            <div className="absolute inset-3 overflow-hidden rounded-md border border-white/10 preview-frame">
              <img
                src={previewUrl}
                alt="Sheet preview"
                className={`h-full w-full object-cover ${status === 'processing' ? 'blur-[4px]' : ''}`}
              />
            </div>
          ) : null}

          <div className="relative z-10 flex flex-col items-center gap-4 px-6 py-8 text-center">
            <Upload className="h-10 w-10 text-white/15" />
            {status !== 'processing' && (
              <>
                <div>
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
            {status === 'processing' && (
              <div className="mt-1 flex bg-black items-center gap-2">
                <p className="text-xs text-white flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Processing in background
                </p>
                <button
                  type="button"
                  onClick={cancel}
                  className="text-xs bg-black  text-white hover:text-neutral-400 cursor-pointer transition-colors underline underline-offset-2"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {status === 'processing' && (
            <div className="absolute inset-4 z-20 flex flex-col justify-end rounded-md border border-white/10 bg-black/30 p-3">
              <div className="flex items-center justify-between text-xs text-white/80 mb-2">
                <span>Processing</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#3b82f6] transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
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

        <div className="space-y-4 h-[21rem]">
          {error && (
            <p className="text-center text-sm text-neutral-400">{error}</p>
          )}

          <div className="rounded-lg border border-white/10 bg-[#12152a] p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-medium text-white">
                  Processing Settings
                </h3>
                <p className="text-xs text-[#a1a1aa]">
                  Tune speed vs. accuracy for the OMR engine
                </p>
              </div>
              <div className="min-w-[140px]">
                <Select
                  value={settings.preset}
                  onValueChange={value => {
                    const preset = value as ProcessingPreset;
                    setSettings(prev => ({
                      ...prev,
                      preset,
                      ...presets[preset],
                    }));
                  }}
                  disabled={status === 'processing'}
                >
                  <SelectTrigger className="border-white/10 bg-[#1e2345]">
                    <SelectValue placeholder="Preset" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fast">Fast</SelectItem>
                    <SelectItem value="balanced">Balanced</SelectItem>
                    <SelectItem value="accuracy">Accuracy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#a1a1aa] w-32">
                  PDF render DPI
                </span>
                <Slider
                  min={72}
                  max={220}
                  step={2}
                  value={[settings.pdfRenderDpi]}
                  onValueChange={([v]) =>
                    setSettings(prev => ({
                      ...prev,
                      preset: 'balanced',
                      pdfRenderDpi: v,
                      pdfMinDpi: Math.min(prev.pdfMinDpi, v),
                    }))
                  }
                  disabled={status === 'processing'}
                  className="flex-1"
                />
                <span className="text-xs text-[#a1a1aa] w-10 text-right tabular-nums">
                  {settings.pdfRenderDpi}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-[#a1a1aa] w-32">Min DPI</span>
                <Slider
                  min={72}
                  max={settings.pdfRenderDpi}
                  step={2}
                  value={[settings.pdfMinDpi]}
                  onValueChange={([v]) =>
                    setSettings(prev => ({
                      ...prev,
                      preset: 'balanced',
                      pdfMinDpi: v,
                    }))
                  }
                  disabled={status === 'processing'}
                  className="flex-1"
                />
                <span className="text-xs text-[#a1a1aa] w-10 text-right tabular-nums">
                  {settings.pdfMinDpi}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-[#a1a1aa] w-32">
                  Max image pixels
                </span>
                <Slider
                  min={800000}
                  max={6000000}
                  step={100000}
                  value={[settings.maxImagePixels]}
                  onValueChange={([v]) =>
                    setSettings(prev => ({
                      ...prev,
                      preset: 'balanced',
                      maxImagePixels: v,
                    }))
                  }
                  disabled={status === 'processing'}
                  className="flex-1"
                />
                <span className="text-xs text-[#a1a1aa] w-16 text-right tabular-nums">
                  {Math.round(settings.maxImagePixels / 1000)}k
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-[#a1a1aa] w-32">
                  Inference batch
                </span>
                <Slider
                  min={4}
                  max={64}
                  step={1}
                  value={[settings.inferenceBatchSize]}
                  onValueChange={([v]) =>
                    setSettings(prev => ({
                      ...prev,
                      preset: 'balanced',
                      inferenceBatchSize: v,
                    }))
                  }
                  disabled={status === 'processing'}
                  className="flex-1"
                />
                <span className="text-xs text-[#a1a1aa] w-10 text-right tabular-nums">
                  {settings.inferenceBatchSize}
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-md border border-white/5 bg-[#0c0e1f] p-3 text-[11px] text-[#a1a1aa] leading-relaxed">
              <p className="mb-2 text-xs text-white/70">
                How these affect OMR:
              </p>
              <div className="grid gap-1">
                <p>Higher PDF DPI captures more detail but slows conversion.</p>
                <p>
                  Min DPI is the floor after downscaling large pages to fit the
                  max pixel limit.
                </p>
                <p>
                  Max image pixels caps memory usage; lower values speed up at
                  the cost of detail.
                </p>
                <p>
                  Inference batch size trades VRAM/RAM for speed; too high can
                  cause slowdowns.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
