/** Compact header status dot. @param {{status: 'loading'|'ok'|'error'}} props */
export default function StatusIndicator({ status }) {
  const map = {
    loading: { text: 'Checking', dot: 'bg-control' },
    ok: { text: 'Online', dot: 'bg-primary' },
    error: { text: 'Offline', dot: 'bg-secondary' },
  };
  const s = map[status];
  return (
    <div role="status" aria-label={`Backend status: ${s.text}`} className="hidden items-center gap-2 border border-border px-3 py-2 sm:flex">
      <span className={`h-2 w-2 ${s.dot}`} aria-hidden="true" />
      <span className="nx-label !text-body">{s.text}</span>
    </div>
  );
}
