import { dijkstra } from '../engine/dijkstra.js';
import { aStar } from '../engine/astar.js';

const UNITS = { distance: 'meters', time: 'seconds' };

/**
 * Run a routing algorithm and shape the result for the API.
 * No Express objects here: this layer is plain JavaScript and unit-testable.
 *
 * @param {import('../engine/Graph.js').Graph} graph
 * @param {{algorithm: 'dijkstra'|'astar', metric: 'distance'|'time', source: string|number, destination: string|number, includeDetails?: boolean}} request
 */
export function computeRoute(graph, { algorithm, metric, source, destination, includeDetails = false }) {
  const run = algorithm === 'astar' ? aStar : dijkstra;
  const r = run(graph, source, destination, { metric, collectExploredEdges: includeDetails });

  const coordinates = r.path.map((id) => {
    const v = graph.getVertex(id);
    return { id, lat: v.lat ?? null, lng: v.lng ?? null };
  });
  const distanceMeters = r.found ? r.pathEdges.reduce((s, e) => s + e.distance, 0) : null;
  const allHaveTime = r.found && r.pathEdges.every((e) => e.time !== null);
  const estimatedTimeSeconds = allHaveTime ? r.pathEdges.reduce((s, e) => s + e.time, 0) : null;

  // Real road shape when edges carry geometry (OSM); otherwise straight lines between vertices.
  let routeGeometry = [];
  if (r.found) {
    const hasShapes = r.pathEdges.length > 0 && r.pathEdges.every((e) => Array.isArray(e.geometry));
    if (hasShapes) {
      for (const e of r.pathEdges) {
        for (const pt of e.geometry) {
          const last = routeGeometry[routeGeometry.length - 1];
          if (!last || last[0] !== pt.lat || last[1] !== pt.lng) routeGeometry.push([pt.lat, pt.lng]);
        }
      }
    } else {
      routeGeometry = coordinates.filter((c) => c.lat !== null).map((c) => [c.lat, c.lng]);
    }
  }

  const response = {
    found: r.found,
    algorithm: r.algorithm,
    metric,
    source: r.source,
    destination: r.target,
    reason: r.reason,
    cost: r.found ? { value: r.cost, unit: UNITS[metric] } : null,
    distanceMeters,
    estimatedTimeSeconds,
    path: r.path,
    coordinates,
    routeGeometry,
    roads: r.pathEdges.map((e) => ({ from: e.from, to: e.to, name: e.name, roadType: e.roadType, distance: e.distance })),
    executionTimeMs: r.executionTimeMs,
    stats: r.stats,
    notes: [
      'Estimated travel time uses assumed road speeds. It is not live traffic data.',
      'Execution time depends on hardware, graph size and runtime conditions.',
    ],
  };
  if (r.heuristic) response.heuristic = r.heuristic;
  if (includeDetails) {
    response.visitedNodes = r.visitedNodes;
    response.exploredEdges = r.exploredEdges;
  }
  return response;
}
