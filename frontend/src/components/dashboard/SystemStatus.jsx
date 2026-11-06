import Card from '../ui/Card.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import LoadingIndicator from '../ui/LoadingIndicator.jsx';
import ErrorState from '../ui/ErrorState.jsx';

/** Live panel: shows the REAL result of GET /api/health. @param {{health: ReturnType<import('../../hooks/useHealth.js').useHealth>}} props */
export default function SystemStatus({ health }) {
  const { status, data, error, refresh } = health;
  return (
    <Card
      meta="Live"
      title="System Status"
      actions={<Button size="sm" variant="secondary" onClick={refresh} disabled={status === 'loading'}>Refresh</Button>}
    >
      {status === 'loading' && <LoadingIndicator label="Checking backend" />}
      {status === 'error' && <ErrorState title="Backend unreachable" message={error} onRetry={refresh} />}
      {status === 'ok' && (
        <dl className="grid grid-cols-2 gap-3 font-mono text-xs">
          <div><dt className="nx-label">Backend</dt><dd className="mt-1"><Badge tone="green">Online</Badge></dd></div>
          <div><dt className="nx-label">Service</dt><dd className="mt-1 text-ink">{data.service}</dd></div>
          <div><dt className="nx-label">Uptime</dt><dd className="mt-1 text-ink">{data.uptimeSeconds}s</dd></div>
          <div><dt className="nx-label">Checked</dt><dd className="mt-1 text-ink">{new Date(data.timestamp).toLocaleTimeString()}</dd></div>
        </dl>
      )}
    </Card>
  );
}
