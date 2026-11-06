import { useMemo } from 'react';
import Card from '../ui/Card.jsx';
import Badge from '../ui/Badge.jsx';
import GraphCanvas from './GraphCanvas.jsx';
import { replayAll } from '../../lab/labState.js';
import { useUnits } from '../../hooks/useUnits.js';

/**
 * Side-by-side comparison of Dijkstra and A* on the same graph and pair, built from the real runs.
 * @param {{graph: object, data: {runs: {dijkstra: object, astar: object}, comparison: object}, source: string, target: string}} props
 */
export default function CompareView({ graph, data, source, target }) {
  const { formatDistance, formatDuration } = useUnits();
  const fmtCost = (v, metric) => (v === null ? 'no path' : metric === 'time' ? formatDuration(v) : formatDistance(v));
  const { dijkstra: d, astar: a } = data.runs;
  const finalStates = useMemo(() => ({ dijkstra: replayAll(d.events), astar: replayAll(a.events) }), [d, a]);
  const rows = [
    ['Nodes explored (visited)', d.metrics.nodesVisited, a.metrics.nodesVisited],
    ['Edges explored', d.metrics.edgesExplored, a.metrics.edgesExplored],
    ['Priority queue operations', d.metrics.priorityQueueOperations, a.metrics.priorityQueueOperations],
    ['Path cost', fmtCost(d.cost, d.metric), fmtCost(a.cost, a.metric)],
    ['Path length (nodes)', d.metrics.pathNodes, a.metrics.pathNodes],
    ['Execution time (median)', `${d.metrics.executionTimeMs.toFixed(3)} ms`, `${a.metrics.executionTimeMs.toFixed(3)} ms`],
  ];
  return (
    <Card meta="Comparison" title="Dijkstra vs A*" actions={<Badge tone="cyan">Same graph, same pair</Badge>}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[22rem] text-left font-mono text-xs">
          <caption className="sr-only">Metrics for Dijkstra and A* on the same graph</caption>
          <thead>
            <tr className="nx-label border-b border-border">
              <th scope="col" className="py-2 pr-3 font-normal">Metric</th>
              <th scope="col" className="py-2 pr-3 font-normal">Dijkstra</th>
              <th scope="col" className="py-2 font-normal">A*</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, x, y]) => (
              <tr key={k} className="border-b border-border/50">
                <th scope="row" className="py-2 pr-3 font-normal text-muted">{k}</th>
                <td className="py-2 pr-3 text-ink">{x}</td>
                <td className="py-2 text-ink">{y}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-3 flex flex-col gap-1 font-mono text-xs text-body">
        {data.comparison.summary.map((line) => <li key={line}>• {line}</li>)}
      </ul>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {[['Dijkstra', 'dijkstra'], ['A*', 'astar']].map(([title, key]) => (
          <figure key={key}>
            <figcaption className="nx-label mb-1">{title}: final search state</figcaption>
            <GraphCanvas graph={graph} state={finalStates[key]} source={source} target={target} label={`${title} final search state: ${finalStates[key].counters.nodesVisited} nodes visited`} />
          </figure>
        ))}
      </div>
    </Card>
  );
}
