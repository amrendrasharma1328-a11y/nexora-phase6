import Card from '../ui/Card.jsx';
import Badge from '../ui/Badge.jsx';

/** @param {{label: string, value: string, hint?: string, demo?: boolean}} props */
export default function StatCard({ label, value, hint, demo = false }) {
  return (
    <Card as="article">
      <div className="flex items-start justify-between gap-2">
        <p className="nx-label">{label}</p>
        {demo && <Badge tone="magenta">Demo</Badge>}
      </div>
      <p className="mt-3 font-sans text-3xl font-semibold text-ink">{value}</p>
      {hint && <p className="mt-1 font-mono text-xs text-muted">{hint}</p>}
    </Card>
  );
}
