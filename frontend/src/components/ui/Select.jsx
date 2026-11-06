import { forwardRef, useId } from 'react';

/**
 * Labelled native select.
 * @param {{label: string, hint?: string, options: {value: any, label: string}[]} & import('react').SelectHTMLAttributes<HTMLSelectElement>} props
 */
const Select = forwardRef(function Select({ label, hint, options, id, className = '', ...rest }, ref) {
  const autoId = useId();
  const selectId = id || autoId;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={selectId} className="nx-label">{label}</label>
      <select
        ref={ref}
        id={selectId}
        aria-describedby={hint ? `${selectId}-hint` : undefined}
        className="h-10 border border-control bg-bg px-3 font-mono text-sm text-ink hover:border-primary disabled:opacity-50"
        {...rest}
      >
        {options.map((o) => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <p id={`${selectId}-hint`} className="font-mono text-xs text-muted">{hint}</p>}
    </div>
  );
});

export default Select;
