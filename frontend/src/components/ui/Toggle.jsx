import { useId } from 'react';

/**
 * On/off switch (native checkbox with role="switch").
 * @param {{label: string, description?: string, checked: boolean, onChange: (v: boolean) => void}} props
 */
export default function Toggle({ label, description, checked, onChange }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm text-ink">{label}</label>
        {description && <p id={`${id}-desc`} className="font-mono text-xs text-muted">{description}</p>}
      </div>
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          aria-describedby={description ? `${id}-desc` : undefined}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        />
        <span aria-hidden="true" className={`absolute inset-0 border transition-colors duration-fast peer-focus-visible:shadow-focus ${checked ? 'border-primary bg-primary/20' : 'border-control bg-bg'}`} />
        <span aria-hidden="true" className={`absolute top-1 h-4 w-4 transition-all duration-fast ${checked ? 'left-6 bg-primary' : 'left-1 bg-control'}`} />
      </span>
    </div>
  );
}
