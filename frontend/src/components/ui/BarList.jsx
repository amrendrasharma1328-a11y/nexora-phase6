const TONES = { green: 'bg-primary', cyan: 'bg-cyan', magenta: 'bg-secondary' };

/**
 * Horizontal bars for ranked or categorical data. Values are real numbers; `display` is the text shown.
 * @param {{items: {id: string, label: string, value: number, display: string, tone?: 'green'|'cyan'|'magenta', note?: string}[],
 *   label: string, max?: number}} props
 */
export default function BarList({ items, label, max }) {
  const top = max ?? Math.max(...items.map((i) => i.value), 0);
  return (
    <ul aria-label={label} className="flex flex-col gap-3">
      {items.map((i) => (
        <li key={i.id}>
          <div className="mb-1 flex items-baseline justify-between gap-3 font-mono text-xs">
            <span className="min-w-0 truncate text-ink" title={i.label}>{i.label}</span>
            <span className="shrink-0 text-body">{i.display}</span>
          </div>
          <div className="h-2 border border-border" aria-hidden="true">
            <div className={`h-full ${TONES[i.tone ?? 'green']}`} style={{ width: `${top > 0 ? Math.max(i.value > 0 ? 2 : 0, (i.value / top) * 100) : 0}%` }} />
          </div>
          {i.note && <p className="mt-1 font-mono text-[0.6875rem] text-muted">{i.note}</p>}
        </li>
      ))}
    </ul>
  );
}
