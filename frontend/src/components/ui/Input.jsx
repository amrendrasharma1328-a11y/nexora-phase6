import { forwardRef, useId } from 'react';

/**
 * Labelled text input with hint/error support.
 * @param {{label: string, hint?: string, error?: string} & import('react').InputHTMLAttributes<HTMLInputElement>} props
 */
const Input = forwardRef(function Input({ label, hint, error, id, className = '', ...rest }, ref) {
  const autoId = useId();
  const inputId = id || autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={inputId} className="nx-label">{label}</label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`h-10 border bg-bg px-3 font-mono text-sm text-ink placeholder:text-muted/60 transition-colors duration-fast hover:border-primary disabled:opacity-50 ${error ? 'border-secondary' : 'border-control'}`}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="font-mono text-xs text-secondary">{error}</p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="font-mono text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
});

export default Input;
