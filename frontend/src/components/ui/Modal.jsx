import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog: focus trap, Escape to close, focus restore.
 * @param {{open: boolean, onClose: () => void, title: string, footer?: import('react').ReactNode,
 *   children?: import('react').ReactNode}} props
 */
export default function Modal({ open, onClose, title, footer, children }) {
  const titleId = useId();
  const panelRef = useRef(null);
  // Keep the latest onClose in a ref: parents usually pass an inline function, and re-running the effect on
  // every render would steal focus back to the first control while the user types in a field.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const panel = panelRef.current;
    // Focus: an element marked data-autofocus (e.g. Cancel in destructive dialogs), else the first control.
    (panel?.querySelector('[data-autofocus]') ?? panel?.querySelector(FOCUSABLE))?.focus();
    document.body.style.overflow = 'hidden';

    function onKeyDown(e) {
      if (e.key === 'Escape') { onCloseRef.current(); return; }
      if (e.key !== 'Tab' || !panel) return;
      const items = panel.querySelectorAll(FOCUSABLE);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onCloseRef.current(); }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-lg border border-control border-t-2 border-t-primary bg-surface shadow-glow-green">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id={titleId} className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="flex h-8 w-8 items-center justify-center text-muted hover:text-primary">
            <Icon name="close" size={16} />
          </button>
        </header>
        <div className="p-4 text-sm">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-border px-4 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
