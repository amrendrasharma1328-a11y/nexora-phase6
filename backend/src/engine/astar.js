import { MinHeap } from './MinHeap.js';
import { RouteError } from './errors.js';
import { haversineMeters } from './geo.js';
import { validateRouteRequest, reconstructPath, requireWeight, buildResult } from './pathUtils.js';
import { makeEmitter } from './events.js';

/**
 * Build the default geographic heuristic h(n) = straight-line distance(n, target) * scale.
 * Units are kept compatible with edge costs:
 *  - metric "distance": meters, scaled by graph.minDistanceRatio (<= 1) so it never overestimates.
 *  - metric "time": seconds = meters / graph.maxSpeedMps, which never overestimates.
 * Vertices without coordinates get h = 0 (always safe).
 */
export function createGeoHeuristic(graph, target, metric) {
  const t = graph.getVertex(target);
  if (!t || t.lat === undefined) {
    throw new RouteError('MISSING_COORDINATES', 'A* needs coordinates for the destination vertex');
  }
  const { minDistanceRatio, maxSpeedMps } = graph.getHeuristicScales();
  const scale = metric === 'time' ? (maxSpeedMps > 0 ? 1 / maxSpeedMps : 0) : minDistanceRatio;
  const h = (id) => {
    const v = graph.getVertex(id);
    if (!v || v.lat === undefined) return 0;
    return haversineMeters(v, t) * scale;
  };
  h.description = { name: 'haversine', unit: metric === 'time' ? 'seconds' : 'meters', scale };
  return h;
}

/**
 * A* search with g-score, h-score, f = g + h, parent tracking and the custom MinHeap.
 * Optimal when the heuristic is admissible; re-opens nodes if a cheaper path is found,
 * so it stays correct even for admissible-but-inconsistent custom heuristics.
 *
 * @param {import('./Graph.js').Graph} graph
 * @param {string|number} source
 * @param {string|number} target
 * Optionally emits structured execution events (see events.js) through `onEvent`.
 *
 * @param {{metric?: 'distance'|'time', heuristic?: (id: string) => number, collectExploredEdges?: boolean, onEvent?: (event: object) => void}} [options]
 */
export function aStar(graph, source, target, { metric = 'distance', heuristic, collectExploredEdges = true, onEvent = null } = {}) {
  const ids = validateRouteRequest(graph, source, target, metric);
  const h = heuristic ?? createGeoHeuristic(graph, ids.target, metric);
  const emit = makeEmitter(onEvent);
  const startedAt = performance.now();

  const g = new Map([[ids.source, 0]]);
  const parents = new Map();
  const visitedSet = new Set();
  const visited = [];
  const exploredEdges = [];
  let edgesExplored = 0;
  let reExpansions = 0;
  let reached = false;
  const heap = new MinHeap();
  emit?.({ type: 'start', algorithm: 'astar', metric, source: ids.source, target: ids.target });
  const h0 = h(ids.source);
  heap.insert({ id: ids.source, g: 0 }, h0);
  emit?.({ type: 'queue_push', node: ids.source, priority: h0, queueSize: heap.size, reason: 'source' });

  while (!heap.isEmpty()) {
    const { value: { id: u, g: gAtPush }, priority: popped } = heap.extractMin();
    const stale = gAtPush > g.get(u); // stale entry: a cheaper path was found later
    emit?.({ type: 'queue_pop', node: u, priority: popped, queueSize: heap.size, stale });
    if (stale) continue;
    const reExpansion = visitedSet.has(u);
    if (reExpansion) reExpansions += 1;
    else { visitedSet.add(u); visited.push(u); }
    if (emit) {
      const hu = h(u);
      emit({ type: 'node_visited', node: u, cost: g.get(u), h: hu, f: g.get(u) + hu, order: visited.length, reExpansion });
    }
    if (u === ids.target) {
      reached = true;
      emit?.({ type: 'destination_reached', node: u, cost: g.get(u) });
      break;
    }

    for (const edge of graph.getNeighbors(u)) {
      const w = requireWeight(edge, metric, graph.getWeight(edge, metric));
      edgesExplored += 1;
      if (collectExploredEdges) exploredEdges.push({ from: u, to: edge.to });
      emit?.({ type: 'edge_explored', from: u, to: edge.to, weight: w });
      const tentative = g.get(u) + w;
      const old = g.get(edge.to);
      if (tentative < (old ?? Infinity)) {
        const hv = h(edge.to);
        g.set(edge.to, tentative);
        parents.set(edge.to, { prev: u, edge });
        emit?.({ type: 'distance_updated', node: edge.to, via: u, oldValue: old ?? null, newValue: tentative, h: hv, f: tentative + hv });
        heap.insert({ id: edge.to, g: tentative }, tentative + hv); // f = g + h
        emit?.({ type: 'queue_push', node: edge.to, priority: tentative + hv, queueSize: heap.size, reason: 'improved' });
      }
    }
  }

  const parentsResult = reached ? reconstructPath(parents, ids.source, ids.target) : null;
  if (emit) {
    if (parentsResult) emit({ type: 'path_reconstructed', path: parentsResult.path, cost: g.get(ids.target), edgeCount: parentsResult.edges.length });
    else emit({ type: 'no_path', visitedCount: visited.length });
  }

  return buildResult({
    algorithm: 'astar',
    metric,
    source: ids.source,
    target: ids.target,
    parentsResult,
    cost: reached ? g.get(ids.target) : null,
    visited,
    exploredEdges,
    edgesExplored,
    heap,
    startedAt,
    extra: {
      heuristic: h.description ?? { name: 'custom' },
      reExpansions,
      scores: reached ? { g: g.get(ids.target), h: h(ids.target), f: g.get(ids.target) + h(ids.target) } : null,
    },
  });
}
