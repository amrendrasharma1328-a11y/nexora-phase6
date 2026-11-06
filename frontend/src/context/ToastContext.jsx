import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/ui/Icon.jsx';

const NotifyContext = createContext(null);
const MAX_TOASTS = 4;
const DURATION = { success: 4000, info: 5000, error: 8000 };
const TONE = {
  success: { rail: 'border-l-primary', icon: 'check', iconClass: 'text-primary', label: 'Success' },
  info: { rail: 'border-l-cyan', icon: 'info', iconClass: 'text-cyan', label: 'Info' },
  error: { rail: 'border-l-secondary', icon: 'alert', iconClass: 'text-secondary', label: 'Error' },
};

function Toast({ toast, onDismiss }) {
  const tone = TONE[toast.tone];
  const [paused, setPaused] = useState(false);
  const remaining = useRef(toast.duration);
  const startedAt = useRef(0);

  useEffect(() => {
    if (paused) return undefined;
    startedAt.current = Date.now();
    const timer = setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(1000, remaining.current - (Date.now() - startedAt.current));
    };
  }, [paused, onDismiss, toast.id]);

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 border border-control border-l-4 bg-surface px-3 py-3 shadow-glow-green ${tone.rail}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Icon name={tone.icon} size={18} className={`mt-0.5 shrink-0 ${tone.iconClass}`} />
      <p className="min-w-0 flex-1 text-sm text-ink">
        <span className="sr-only">{tone.label}: </span>
        {toast.message}
      </p>
      <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification" className="flex h-6 w-6 shrink-0 items-center justify-center text-muted hover:text-primary">
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}

/**
 * Notifications. Success/info are announced politely, errors assertively (separate persistent live regions).
 * Toasts pause while hovered or focused and can always be dismissed.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const push = useCallback((tone, message, options = {}) => {
    const id = nextId.current++;
    setToasts((all) => [...all.slice(-(MAX_TOASTS - 1)), { id, tone, message, duration: options.duration ?? DURATION[tone] }]);
    return id;
  }, []);

  const notify = useMemo(() => ({
    success: (m, o) => push('success', m, o),
    info: (m, o) => push('info', m, o),
    error: (m, o) => push('error', m, o),
    dismiss,
  }), [push, dismiss]);

  return (
    <NotifyContext.Provider value={notify}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        <div role="status" aria-live="polite" className="flex flex-col gap-2">
          {toasts.filter((t) => t.tone !== 'error').map((t) => <Toast key={t.id} toast={t} onDismiss={dismiss} />)}
        </div>
        <div role="alert" aria-live="assertive" className="flex flex-col gap-2">
          {toasts.filter((t) => t.tone === 'error').map((t) => <Toast key={t.id} toast={t} onDismiss={dismiss} />)}
        </div>
      </div>
    </NotifyContext.Provider>
  );
}

export function useNotify() {
  const ctx = useContext(NotifyContext);
  if (!ctx) throw new Error('useNotify must be used inside <ToastProvider>');
  return ctx;
}
