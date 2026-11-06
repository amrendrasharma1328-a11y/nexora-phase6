import { Link } from 'react-router-dom';
import Card from '../ui/Card.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { formatMs } from '../../api/format.js';
import { useUnits } from '../../hooks/useUnits.js';

/**
 * Shows the REAL result returned by the routing API.
 * @param {{result: object, saved?: {id: string, name: string}|null, onSave?: () => void}} props
 */
export default function RouteSummary({ result, saved = null, onSave }) {
  const { formatDistance, formatDuration } = useUnits();
  if (!result.found) {
    return (
      <EmptyState title="No route found" description="No drivable path exists between these two points on the loaded road network (for example because of one-way roads or disconnected areas)." />
    );
  }
  const snapped = result.snapped;
  const items = [
    ['Distance', formatDistance(result.distanceMeters)],
    ['Estimated time', formatDuration(result.estimatedTimeSeconds)],
    ['Algorithm', result.algorithm === 'astar' ? 'A*' : 'Dijkstra'],
    ['Optimised for', result.metric === 'time' ? 'Estimated time' : 'Distance'],
    ['Nodes visited', String(result.stats.nodesVisited)],
    ['Edges explored', String(result.stats.edgesExplored)],
    ['Execution time', formatMs(result.executionTimeMs)],
  ];
  return (
    <Card meta="Result" title="Computed route" actions={<Badge tone={result.dataSource?.type === 'osm' ? 'green' : 'magenta'}>{result.dataSource?.type === 'osm' ? 'OSM data' : 'Sample graph'}</Badge>}>
      <dl className="grid grid-cols-2 gap-3 font-mono text-xs">
        {items.map(([k, v]) => (
          <div key={k}><dt className="nx-label">{k}</dt><dd className="mt-1 text-sm text-ink">{v}</dd></div>
        ))}
      </dl>
      {onSave && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          {saved ? (
            <>
              <Badge tone="green">Saved</Badge>
              <span className="min-w-0 truncate font-mono text-xs text-ink" title={saved.name}>{saved.name}</span>
              <Link to="/app/saved-routes" className="font-mono text-xs text-primary underline underline-offset-4 hover:text-ink">View saved routes</Link>
            </>
          ) : (
            <Button variant="secondary" onClick={onSave}>Save route</Button>
          )}
        </div>
      )}
      {snapped && (
        <p className="mt-3 font-mono text-xs text-muted">
          Points were snapped to the nearest road intersection
          {snapped.source ? ` (source ${Math.round(snapped.source.distanceMeters)} m` : ''}
          {snapped.destination ? `${snapped.source ? ', ' : ' ('}destination ${Math.round(snapped.destination.distanceMeters)} m` : ''}
          {snapped.source || snapped.destination ? ' away).' : '.'}
        </p>
      )}
      <ul className="mt-3 flex flex-col gap-1 font-mono text-[0.6875rem] text-muted">
        {result.notes.map((n) => <li key={n}>• {n}</li>)}
      </ul>
    </Card>
  );
}
