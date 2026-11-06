import Card from '../ui/Card.jsx';
import Badge from '../ui/Badge.jsx';

/** Live graph statistic from the backend. @param {{title: string, field: string, stats: ReturnType<import('../../hooks/useGraphStats.js').useGraphStats>}} props */
export default function GraphStat({ title, field, stats }) {
  const { status, data, error } = stats;
  const sample = data?.dataSource?.type === 'sample';
  return (
    <Card meta="Graph" title={title} actions={status === 'ok' ? <Badge tone={sample ? 'magenta' : 'green'}>{sample ? 'Sample' : 'OSM'}</Badge> : null}>
      {status === 'loading' && <p className="font-mono text-xs text-muted">Loading…</p>}
      {status === 'error' && <p role="alert" className="font-mono text-xs text-secondary">{error}</p>}
      {status === 'ok' && (
        <>
          <p className="font-sans text-3xl font-semibold text-ink">{data.graph[field].toLocaleString()}</p>
          <p className="mt-1 font-mono text-xs text-muted">{sample ? 'Synthetic sample graph, not real roads.' : `Road network: ${data.dataSource.region}`}</p>
        </>
      )}
    </Card>
  );
}
