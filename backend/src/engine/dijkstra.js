import { MinHeap } from './MinHeap.js';
import { validateRouteRequest, reconstructPath, requireWeight, buildResult } from './pathUtils.js';
import { makeEmitter } from './events.js';

/**
 * Dijkstra's shortest path using the custom MinHeap (lazy deletion of stale entries).
 * Requires non-negative edge weights (enforced by Graph). Stops as soon as the target is settled.
 * Optionally emits structured execution events (see events.js) through `onEvent`.
 *
 * @param {import('./Graph.js').Graph} graph
 * @param {string|number} source
 * @param {string|number} target
 * @param {{metric?: 'distance'|'time', collectExploredEdges?: boolean, onEvent?: (event: object) => void}} [options]
 */
export function dijkstra(graph, source, target, { metric = 'distance', collectExploredEdges = true, onEvent = null } = {}) {
  const ids = validateRouteRequest(graph, source, target, metric);
  const emit = makeEmitter(onEvent);
  const startedAt = performance.now();

  const dist = new Map([[ids.source, 0]]);
  const parents = new Map();
  const settled = new Set();
  const visited = [];
  const exploredEdges = [];
  let edgesExplored = 0;
  const heap = new MinHeap();

  emit?.({ type: 'start', algorithm: 'dijkstra', metric, source: ids.source, target: ids.target });
  heap.insert(ids.source, 0);
  emit?.({ type: 'queue_push', node: ids.source, priority: 0, queueSize: heap.size, reason: 'source' });

  while (!heap.isEmpty()) {
    const { value: u, priority: d } = heap.extractMin();
    const stale = settled.has(u) || d > dist.get(u); // stale heap entry
    emit?.({ type: 'queue_pop', node: u, priority: d, queueSize: heap.size, stale });
    if (stale) continue;
    settled.add(u);
    visited.push(u);
    emit?.({ type: 'node_visited', node: u, cost: d, order: visited.length });
    if (u === ids.target) {
      emit?.({ type: 'destination_reached', node: u, cost: d });
      break;
    }

    for (const edge of graph.getNeighbors(u)) {
      const w = requireWeight(edge, metric, graph.getWeight(edge, metric));
      edgesExplored += 1;
      if (collectExploredEdges) exploredEdges.push({ from: u, to: edge.to });
      emit?.({ type: 'edge_explored', from: u, to: edge.to, weight: w });
      if (settled.has(edge.to)) continue;
      const candidate = d + w;
      const old = dist.get(edge.to);
      if (candidate < (old ?? Infinity)) {
        dist.set(edge.to, candidate);
        parents.set(edge.to, { prev: u, edge });
        emit?.({ type: 'distance_updated', node: edge.to, via: u, oldValue: old ?? null, newValue: candidate });
        heap.insert(edge.to, candidate);
        emit?.({ type: 'queue_push', node: edge.to, priority: candidate, queueSize: heap.size, reason: 'improved' });
      }
    }
  }

  const reached = settled.has(ids.target);
  const parentsResult = reached ? reconstructPath(parents, ids.source, ids.target) : null;
  if (emit) {
    if (parentsResult) emit({ type: 'path_reconstructed', path: parentsResult.path, cost: dist.get(ids.target), edgeCount: parentsResult.edges.length });
    else emit({ type: 'no_path', visitedCount: visited.length });
  }

  return buildResult({
    algorithm: 'dijkstra',
    metric,
    source: ids.source,
    target: ids.target,
    parentsResult,
    cost: reached ? dist.get(ids.target) : null,
    visited,
    exploredEdges,
    edgesExplored,
    heap,
    startedAt,
  });
}
