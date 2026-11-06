import { dijkstra } from '../engine/dijkstra.js';
import { aStar } from '../engine/astar.js';
import { createSampleGraph } from '../data/sampleGraph.js';

export const LAB_LIMITS = { minSize: 3, maxSize: 25, defaultSize: 12 };
export const LAB_DATA_SOURCE = {
  type: 'sample',
  description: 'Synthetic grid generated in code for visualisation. It is NOT real road data.',
};
const TIMING_RUNS = 7;

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const ALGORITHMS = { dijkstra, astar: aStar };

/**
 * Algorithm Lab service: runs the REAL engine algorithms, records their structured events and
 * measures execution time separately (untraced runs) so event recording does not inflate timings.
 */
export function createLabService() {
  const graphs = new Map();

  function getGraph(rows, cols) {
    const key = `${rows}x${cols}`;
    if (!graphs.has(key)) graphs.set(key, createSampleGraph({ rows, cols, includeExtras: false }));
    return graphs.get(key);
  }

  /** Vertices and de-duplicated edges for drawing. One-way edges are flagged. */
  function describeGraph(rows, cols) {
    const graph = getGraph(rows, cols);
    const vertices = [...graph.vertices.values()].map((v) => ({ id: v.id, lat: v.lat, lng: v.lng }));
    const edges = [];
    for (const list of graph.adjacency.values()) {
      for (const e of list) {
        const hasReverse = graph.getEdge(e.to, e.from) !== null;
        if (hasReverse && e.from > e.to) continue; // draw two-way roads once
        edges.push({ from: e.from, to: e.to, oneWay: !hasReverse, roadType: e.roadType, distance: e.distance });
      }
    }
    return { name: graph.name, rows, cols, dataSource: LAB_DATA_SOURCE, vertices, edges, statistics: graph.statistics() };
  }

  /** Run one algorithm, capturing events. @returns {object} */
  function runTraced({ rows, cols, algorithm, metric = 'distance', source, destination }) {
    const graph = getGraph(rows, cols);
    const run = ALGORITHMS[algorithm];
    const events = [];
    const result = run(graph, source, destination, { metric, collectExploredEdges: false, onEvent: (e) => events.push(e) });

    const timings = [];
    for (let i = 0; i < TIMING_RUNS; i += 1) timings.push(run(graph, source, destination, { metric, collectExploredEdges: false }).executionTimeMs);

    const distanceUpdates = events.reduce((n, e) => n + (e.type === 'distance_updated' ? 1 : 0), 0);
    return {
      algorithm,
      metric,
      source: result.source,
      destination: result.target,
      found: result.found,
      path: result.path,
      cost: result.cost,
      costUnit: metric === 'time' ? 'seconds' : 'meters',
      pathDistanceMeters: result.found ? result.pathEdges.reduce((s, e) => s + e.distance, 0) : null,
      heuristic: result.heuristic ?? null,
      eventCount: events.length,
      events,
      metrics: {
        nodesVisited: result.stats.nodesVisited,
        edgesExplored: result.stats.edgesExplored,
        distanceUpdates,
        heapInserts: result.stats.heapInserts,
        heapExtractions: result.stats.heapExtractions,
        priorityQueueOperations: result.stats.heapInserts + result.stats.heapExtractions,
        pathNodes: result.stats.pathNodes,
        pathEdges: result.stats.pathEdges,
        executionTimeMs: median(timings),
      },
      timingNote: `Execution time is the median of ${TIMING_RUNS} untraced runs on this server. It depends on hardware, graph size and runtime conditions.`,
    };
  }

  /** Run both algorithms on the same graph/pair and summarise the differences from the REAL numbers. */
  function compare(params) {
    const d = runTraced({ ...params, algorithm: 'dijkstra' });
    const a = runTraced({ ...params, algorithm: 'astar' });
    const costsMatch = (d.cost === null && a.cost === null) || (d.cost !== null && a.cost !== null && Math.abs(d.cost - a.cost) < 1e-6);
    const saved = d.metrics.nodesVisited - a.metrics.nodesVisited;
    const lines = [];
    if (d.found && a.found) {
      lines.push(costsMatch ? 'Both algorithms found paths of the same optimal cost.' : 'The path costs differ, which should not happen with an admissible heuristic; please report this.');
      if (saved > 0) lines.push(`A* visited ${saved} fewer nodes than Dijkstra (${a.metrics.nodesVisited} vs ${d.metrics.nodesVisited}) because its heuristic steers the search toward the destination.`);
      else if (saved === 0) lines.push('Both algorithms visited the same number of nodes for this pair.');
      else lines.push(`A* visited ${-saved} more nodes than Dijkstra for this pair.`);
    } else {
      lines.push('No path exists between these two vertices; both algorithms exhausted the reachable nodes.');
    }
    lines.push('Execution times are short and noisy on small graphs and depend on hardware and runtime conditions; compare node counts for search behaviour.');
    return { runs: { dijkstra: d, astar: a }, comparison: { costsMatch, nodesSavedByAStar: saved, summary: lines } };
  }

  return { getGraph, describeGraph, runTraced, compare };
}
