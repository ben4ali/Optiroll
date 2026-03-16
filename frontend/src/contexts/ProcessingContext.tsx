import { processSheetWithProgress } from '@/lib/api';
import type { SSEEvent } from '@/lib/types';
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
}

interface ProcessingContextValue extends ProcessingState {
  startProcessing: (file: File) => void;
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
};

const ProcessingContext = createContext<ProcessingContextValue | null>(null);

export function ProcessingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProcessingState>(INITIAL_STATE);
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const startProcessing = useCallback((file: File) => {
    if (busyRef.current) return;
    busyRef.current = true;

    const controller = new AbortController();
    abortRef.current = controller;

    setState({
      status: 'processing',
      fileName: file.name,
      progress: 0,
      logs: [],
      resultSheetId: null,
      error: null,
    });

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

    processSheetWithProgress(file, handleEvent, controller.signal)
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
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;
    setState(INITIAL_STATE);
  }, []);

  const dismiss = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

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
