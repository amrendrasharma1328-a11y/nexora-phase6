import { useId } from 'react';

/**
 * Column chart over time. Drawn with plain elements (no chart library). Every chart has a text alternative:
 * a summary for assistive tech and a "View as table" disclosure with the exact numbers.
 * @param {{data: {key: string, label: string, value: number|null}[], title: string, valueLabel: string,
 *   formatValue: (v: number|null) => string, tone?: 'green'|'cyan', summary: string}} props
 */
export default function BarChart({ data, title, valueLabel, formatValue, tone = 'green', summary }) {
  const id = useId();
  const max = Math.max(...data.map((d) => d.value ?? 0), 0);
  const first = data[0]; const mid = data[Math.floor(data.length / 2)]; const last = data[data.length - 1];
  return (
    <figure className="m-0">
      <div role="img" aria-label={`${title}. ${summary}`} className="flex h-40 items-end gap-px border-b border-border">
        {data.map((d) => {
          const pct = max > 0 && d.value ? Math.max(3, (d.value / max) * 100) : 0;
          return (
            <div key={d.key} className="flex h-full flex-1 items-end" title={`${d.label}: ${formatValue(d.value)}`}>
              <div className={`w-full ${tone === 'cyan' ? 'bg-cyan' : 'bg-primary'}`} style={{ height: `${pct}%`, minHeight: d.value ? 2 : 0 }} />
            </div>
          );
        })}
      </div>
      {data.length > 0 && (
        <div className="mt-1 flex justify-between font-mono text-[0.6875rem] text-muted" aria-hidden="true">
          <span>{first.label}</span>
          {data.length > 2 && <span>{mid.label}</span>}
          <span>{last.label}</span>
        </div>
      )}
      <figcaption className="mt-2 flex items-center justify-between gap-3 font-mono text-xs text-muted">
        <span>Peak: {formatValue(max || null)}</span>
        <details>
          <summary className="cursor-pointer text-primary hover:text-ink">View as table</summary>
          <div className="mt-2 max-h-48 overflow-y-auto border border-border">
            <table className="w-full text-left" aria-describedby={id}>
              <caption id={id} className="sr-only">{title}</caption>
              <thead><tr className="nx-label border-b border-border"><th scope="col" className="px-2 py-1 font-normal">Day</th><th scope="col" className="px-2 py-1 font-normal">{valueLabel}</th></tr></thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.key} className="border-b border-border/50"><th scope="row" className="px-2 py-1 font-normal text-body">{d.label}</th><td className="px-2 py-1 text-ink">{formatValue(d.value)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </figcaption>
    </figure>
  );
}
