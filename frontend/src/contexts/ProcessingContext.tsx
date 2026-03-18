import { processSheetWithProgress } from '@/lib/api';
import type { ProcessingSettings, SSEEvent } from '@/lib/types';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type ProcessingStatus = 'idle' | 'processing' | 'done' | 'error';

interface ProcessingState {
  status: ProcessingStatus;
  fileName: string | null;
  progress: number;
  logs: string[];
  resultSheetId: number | null;
  error: string | null;
  previewUrl: string | null;
  previewType: 'image' | 'pdf' | null;
}

interface ProcessingContextValue extends ProcessingState {
  startProcessing: (file: File, settings: ProcessingSettings) => void;
  cancel: () => void;
  dismiss: () => void;
}

const INITIAL_STATE: ProcessingState = {
  status: 'idle',
  fileName: null,
  progress: 0,
  logs: [],
  resultSheetId: null,
  error: null,
  previewUrl: null,
  previewType: null,
};

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

async function renderPdfPreview(file: File): Promise<string | null> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const doc = await getDocument({ url: objectUrl }).promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const targetWidth = 600;
    const scale = targetWidth / viewport.width;
    const scaledViewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(scaledViewport.width * dpr);
    canvas.height = Math.floor(scaledViewport.height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.scale(dpr, dpr);
    await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
    await doc.destroy();
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

const ProcessingContext = createContext<ProcessingContextValue | null>(null);

export function ProcessingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProcessingState>(INITIAL_STATE);
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const previewTokenRef = useRef(0);

  const revokePreviewUrl = useCallback(() => {
    if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = null;
  }, []);

  const startProcessing = useCallback(
    (file: File, settings: ProcessingSettings) => {
      if (busyRef.current) return;
      busyRef.current = true;

      revokePreviewUrl();
      previewTokenRef.current += 1;
      const previewToken = previewTokenRef.current;

      const previewType = file.type === 'application/pdf' ? 'pdf' : 'image';
      let previewUrl: string | null = null;
      if (previewType === 'image') {
        previewUrl = URL.createObjectURL(file);
        previewUrlRef.current = previewUrl;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      setState({
        status: 'processing',
        fileName: file.name,
        progress: 0,
        logs: [],
        resultSheetId: null,
        error: null,
        previewUrl,
        previewType,
      });

      if (previewType === 'pdf') {
        renderPdfPreview(file).then(url => {
          if (previewTokenRef.current !== previewToken) return;
          if (!url) return;
          setState(prev => ({
            ...prev,
            previewUrl: url,
            previewType: 'image',
          }));
        });
      }

      const handleEvent = (event: SSEEvent) => {
        setState(prev => {
          if (event.type === 'log') {
            return {
              ...prev,
              progress: event.progress,
              logs: [...prev.logs, event.message],
            };
          }
          return prev;
        });
      };

      processSheetWithProgress(file, handleEvent, controller.signal, settings)
        .then(({ sheetId }) => {
          setState(prev => ({
            ...prev,
            status: 'done',
            progress: 100,
            resultSheetId: sheetId,
          }));
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setState(prev => ({
            ...prev,
            status: 'error',
            error: err instanceof Error ? err.message : 'Processing failed',
          }));
        })
        .finally(() => {
          busyRef.current = false;
          abortRef.current = null;
        });
    },
    [],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;
    revokePreviewUrl();
    setState(INITIAL_STATE);
  }, [revokePreviewUrl]);

  const dismiss = useCallback(() => {
    revokePreviewUrl();
    setState(INITIAL_STATE);
  }, [revokePreviewUrl]);

  return (
    <ProcessingContext.Provider
      value={{ ...state, startProcessing, cancel, dismiss }}
    >
      {children}
    </ProcessingContext.Provider>
  );
}

export function useProcessing(): ProcessingContextValue {
  const ctx = useContext(ProcessingContext);
  if (!ctx) {
    throw new Error('useProcessing must be used within ProcessingProvider');
  }
  return ctx;
}
