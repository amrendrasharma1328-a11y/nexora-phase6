import { useId, useState } from 'react';

/**
 * Tooltip shown on hover and keyboard focus; Escape dismisses it.
 * Wrap a single focusable child.
 * @param {{content: string, children: import('react').ReactElement}} props
 */
export default function Tooltip({ content, children }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">{children}</span>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap border border-control bg-surface px-2 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-ink"
        >
          {content}
        </span>
      )}
    </span>
  );
}
