/** @param {{label?: string, className?: string}} props */
export default function LoadingIndicator({ label = 'Loading', className = '' }) {
  return (
    <div role="status" aria-live="polite" className={`flex items-center gap-3 ${className}`}>
      <span className="h-4 w-4 animate-spin border-2 border-primary border-t-transparent" aria-hidden="true" />
      <span className="nx-label">{label}…</span>
    </div>
  );
}
