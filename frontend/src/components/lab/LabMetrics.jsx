import Card from '../ui/Card.jsx';
import { useUnits } from '../../hooks/useUnits.js';

/**
 * Live metrics (counters come from replayed engine events) plus the measured execution time.
 * @param {{state: object, run: object|null, metric: string}} props
 */
export default function LabMetrics({ state, run, metric }) {
  const { formatDistance, formatDuration } = useUnits();
  const fmtCost = (v, metric) => (v === null || v === undefined ? '—' : metric === 'time' ? formatDuration(v) : formatDistance(v));
  const c = state.counters;
  const rows = [
    ['Nodes visited', String(c.nodesVisited)],
    ['Edges explored', String(c.edgesExplored)],
    ['Priority queue operations', `${c.queuePushes + c.queuePops} (${c.queuePushes} insert / ${c.queuePops} extract)`],
    ['Queue size', String(state.queueSize)],
    ['Distance updates', String(c.distanceUpdates)],
    ['Path cost', state.found ? fmtCost(state.cost, metric) : state.found === false ? 'no path' : '—'],
    ['Path length', state.found ? `${state.path.length} nodes / ${state.path.length - 1} edges` : '—'],
    ['Execution time', run ? `${run.metrics.executionTimeMs.toFixed(3)} ms` : '—'],
  ];
  return (
    <Card meta="Live" title="Metrics">
      <dl className="grid grid-cols-2 gap-3 font-mono text-xs">
        {rows.map(([k, v]) => (
          <div key={k}><dt className="nx-label">{k}</dt><dd className="mt-1 text-sm text-ink">{v}</dd></div>
        ))}
      </dl>
      <p className="mt-3 font-mono text-[0.6875rem] text-muted">
        Counters advance as recorded engine events are replayed. {run ? run.timingNote : 'Execution time is measured on the server after you start a run.'}
      </p>
    </Card>
  );
}
