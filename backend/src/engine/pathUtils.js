import { RouteError } from './errors.js';

export const METRICS = ['distance', 'time'];

const isId = (x) => (typeof x === 'string' && x !== '') || (typeof x === 'number' && !Number.isNaN(x));

/**
 * Validate a routing request and normalise ids.
 * @returns {{source: string, target: string}}
 * @throws {RouteError} INVALID_METRIC | INVALID_VERTEX
 */
export function validateRouteRequest(graph, source, target, metric) {
  if (!METRICS.includes(metric)) {
    throw new RouteError('INVALID_METRIC', `metric must be one of: ${METRICS.join(', ')}`);
  }
  for (const [role, id] of [['source', source], ['destination', target]]) {
    if (!isId(id) || !graph.hasVertex(id)) {
      throw new RouteError('INVALID_VERTEX', `Unknown ${role} vertex: ${JSON.stringify(id)}`, { role, vertex: id });
    }
  }
  return { source: String(source), target: String(target) };
}

/**
 * Rebuild the path by walking parent pointers back from the target.
 * @param {Map<string, {prev: string, edge: object}>} parents
 * @returns {{path: string[], edges: object[]}|null} null if target was never reached
 */
export function reconstructPath(parents, source, target) {
  if (source !== target && !parents.has(target)) return null;
  const path = [target];
  const edges = [];
  let cur = target;
  while (cur !== source) {
    const p = parents.get(cur);
    edges.push(p.edge);
    path.push(p.prev);
    cur = p.prev;
  }
  return { path: path.reverse(), edges: edges.reverse() };
}

/** Throw if an edge lacks a weight for the metric being optimised. */
export function requireWeight(edge, metric, weight) {
  if (weight === null || weight === undefined) {
    throw new RouteError('MISSING_WEIGHT', `Edge ${edge.from} -> ${edge.to} has no "${metric}" weight`, { from: edge.from, to: edge.to, metric });
  }
  return weight;
}

/** Assemble the common result object returned by every algorithm. */
export function buildResult({ algorithm, metric, source, target, parentsResult, cost, visited, exploredEdges, edgesExplored, heap, startedAt, extra = {} }) {
  const found = parentsResult !== null;
  const path = found ? parentsResult.path : [];
  const pathEdges = found ? parentsResult.edges : [];
  return {
    algorithm,
    metric,
    source,
    target,
    found,
    reason: found ? null : 'NO_PATH',
    path,
    pathEdges,
    cost: found ? cost : null,
    visitedNodes: visited,
    exploredEdges,
    executionTimeMs: performance.now() - startedAt,
    stats: {
      nodesVisited: visited.length,
      edgesExplored,
      heapInserts: heap.insertCount,
      heapExtractions: heap.extractCount,
      pathNodes: path.length,
      pathEdges: pathEdges.length,
    },
    ...extra,
  };
}
