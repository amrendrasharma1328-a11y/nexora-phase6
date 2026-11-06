import { useId } from 'react';

/**
 * Accessible single-choice group built on native radio inputs (arrow keys, grouping and labels for free).
 * @param {{legend: string, value: string|number, onChange: (v: any) => void, options: {value: any, label: string, hint?: string}[],
 *   hint?: string, name?: string, columns?: number}} props
 */
export default function RadioGroup({ legend, value, onChange, options, hint, name, columns = 2 }) {
  const autoName = useId();
  const groupName = name ?? autoName;
  const hintId = `${groupName}-hint`;
  const cols = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' }[columns] ?? 'sm:grid-cols-2';
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={hint ? hintId : undefined}>
      <legend className="nx-label mb-1">{legend}</legend>
      <div className={`grid grid-cols-1 gap-2 ${cols}`}>
        {options.map((o) => {
          const checked = o.value === value;
          return (
            <label
              key={String(o.value)}
              className={`flex cursor-pointer items-start gap-3 border px-3 py-2.5 transition-colors duration-fast focus-within:shadow-focus hover:border-primary ${checked ? 'border-primary bg-primary/10' : 'border-control'}`}
            >
              <input
                type="radio"
                name={groupName}
                value={String(o.value)}
                checked={checked}
                onChange={() => onChange(o.value)}
                className="peer sr-only"
              />
              <span aria-hidden="true" className={`mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center border ${checked ? 'border-primary' : 'border-control'}`}>
                {checked && <span className="h-1.5 w-1.5 bg-primary" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm text-ink">{o.label}</span>
                {o.hint && <span className="block font-mono text-xs text-muted">{o.hint}</span>}
              </span>
            </label>
          );
        })}
      </div>
      {hint && <p id={hintId} className="font-mono text-xs text-muted">{hint}</p>}
    </fieldset>
  );
}
