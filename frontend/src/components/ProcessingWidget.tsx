import { useProcessing } from '@/contexts/ProcessingContext';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Minus,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

export function ProcessingWidget() {
  const {
    status,
    fileName,
    progress,
    logs,
    resultSheetId,
    error,
    cancel,
    dismiss,
  } = useProcessing();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsOpen) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, logsOpen]);

  if (status === 'idle') return null;

  // Collapsed: compact pill
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2.5 rounded-full bg-[#181b2e] border border-white/10 shadow-2xl shadow-black/50 backdrop-blur-sm px-4 py-2.5 cursor-pointer transition-all hover:border-white/20"
      >
        {status === 'processing' && (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-white" />
        )}
        {status === 'done' && (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
        )}
        {status === 'error' && (
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
        )}

        {status === 'processing' && (
          <span className="text-xs text-white/70 tabular-nums">{progress}%</span>
        )}
        {status === 'done' && (
          <span className="text-xs text-emerald-400">Done</span>
        )}
        {status === 'error' && (
          <span className="text-xs text-red-400">Failed</span>
        )}

        <ChevronUp className="h-3.5 w-3.5 text-white/40" />
      </button>
    );
  }

  // Expanded: full widget
  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl bg-[#181b2e] border border-white/10 shadow-2xl shadow-black/50 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {status === 'processing' && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-white" />
        )}
        {status === 'done' && (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
        )}
        {status === 'error' && (
          <AlertCircle className="h-4 w-4 shrink-0 text-neutral-400" />
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm text-white truncate">
            {status === 'processing' && `Processing ${fileName}...`}
            {status === 'done' && 'Processing complete'}
            {status === 'error' && 'Processing failed'}
          </p>
        </div>

        {/* Collapse */}
        <button
          onClick={() => setCollapsed(true)}
          className="text-white/40 hover:text-white/70 transition-colors"
          title="Collapse"
        >
          <Minus className="h-4 w-4" />
        </button>

        {/* Close / cancel */}
        {status === 'processing' && (
          <button
            onClick={cancel}
            className="text-white/40 hover:text-white/70 transition-colors"
            title="Cancel processing"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {(status === 'done' || status === 'error') && (
          <button
            onClick={dismiss}
            className="text-white/40 hover:text-white/70 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Progress bar + logs (processing only) */}
      {status === 'processing' && (
        <div className="px-4 pb-3">
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

          <button
            type="button"
            onClick={() => setLogsOpen(o => !o)}
            className="mt-2 flex items-center gap-1 text-xs text-[#a1a1aa] hover:text-white/70 transition-colors"
          >
            {logsOpen ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            {logsOpen ? 'Hide' : 'Show'} logs ({logs.length})
          </button>

          {logsOpen && (
            <div className="mt-2 max-h-32 overflow-y-auto rounded-lg bg-[#0c0e1f] border border-white/5 p-2 font-mono text-[11px] leading-relaxed text-[#a1a1aa]">
              {logs.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}

          <button
            type="button"
            onClick={cancel}
            className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.04] py-1.5 text-xs text-[#a1a1aa] hover:bg-white/[0.08] hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Done action */}
      {status === 'done' && resultSheetId != null && (
        <div className="px-4 pb-3">
          <button
            onClick={() => {
              navigate(`/player/${resultSheetId}`);
              dismiss();
            }}
            className="w-full rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white text-sm py-2 font-medium transition-colors"
          >
            Open in Player
          </button>
        </div>
      )}

      {/* Error detail */}
      {status === 'error' && error && (
        <div className="px-4 pb-3">
          <p className="text-xs text-red-400/80">{error}</p>
        </div>
      )}
    </div>
  );
}
