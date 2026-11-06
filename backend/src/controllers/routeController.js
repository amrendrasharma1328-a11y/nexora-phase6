import { RouteError, GraphError } from '../engine/errors.js';
import { METRICS } from '../engine/pathUtils.js';
import { computeRoute } from '../services/routingService.js';
import { SpatialIndex } from '../osm/spatialIndex.js';
import { validateRouteLabels } from '../validation/inputs.js';

const isId = (x) => (typeof x === 'string' && x.trim() !== '') || (typeof x === 'number' && Number.isFinite(x));
const isCoordinate = (x) =>
  x !== null && typeof x === 'object' && !Array.isArray(x) &&
  Number.isFinite(x.lat) && Number.isFinite(x.lng) && Math.abs(x.lat) <= 90 && Math.abs(x.lng) <= 180;
const isLocation = (x) => isId(x) || isCoordinate(x);

const STATUS_BY_CODE = {
  INVALID_VERTEX: 404,
  INVALID_METRIC: 400,
  NO_NEARBY_ROAD: 422,
  MISSING_COORDINATES: 422,
  MISSING_WEIGHT: 422,
};

function sendError(res, status, code, message, details) {
  return res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
}

/** @returns {{error: string}|{value: object}} */
function parseBody(body, { allowMetric }) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Request body must be a JSON object' };
  const { source, destination, metric, includeDetails } = body;
  const labels = validateRouteLabels(body.labels);
  if (labels.error) return { error: labels.error };
  if (!isLocation(source)) return { error: '"source" is required: a vertex id or {lat, lng}' };
  if (!isLocation(destination)) return { error: '"destination" is required: a vertex id or {lat, lng}' };
  if (allowMetric && metric !== undefined && !METRICS.includes(metric)) {
    return { error: `"metric" must be one of: ${METRICS.join(', ')}` };
  }
  if (includeDetails !== undefined && typeof includeDetails !== 'boolean') return { error: '"includeDetails" must be a boolean' };
  return { value: { source, destination, metric, includeDetails: includeDetails === true, labels: labels.value } };
}

/**
 * Controllers only validate input and translate errors to HTTP; all routing logic lives in services/engine.
 * Locations may be vertex ids OR {lat, lng}; coordinates are snapped to the nearest road intersection.
 * `onRoute` (optional) is called after a successful calculation when the request carries a valid control
 * session (`req.workspaceId`), so the calculation can be recorded in route history. A failing recorder never
 * breaks the routing response.
 * @param {{graph: import('../engine/Graph.js').Graph, dataSource: object, spatialIndex?: SpatialIndex, maxSnapMeters?: number,
 *   onRoute?: (event: {workspaceId: string, request: object, labels: object, payload: object}) => Promise<void>}} deps
 */
export function createRouteController({ graph, dataSource, spatialIndex = new SpatialIndex(graph), maxSnapMeters = 500, onRoute = null }) {
  /** Resolve an id or coordinate into a vertex id (+ snapping details for coordinates). */
  function resolve(value, role) {
    if (!isCoordinate(value)) return { id: value, snap: null };
    const hit = spatialIndex.nearest(value, { maxMeters: maxSnapMeters });
    if (!hit) {
      throw new RouteError('NO_NEARBY_ROAD', `No road intersection within ${maxSnapMeters} m of the ${role} location`, { role, requested: value, maxSnapMeters });
    }
    return { id: hit.id, snap: { requested: { lat: value.lat, lng: value.lng }, vertexId: hit.id, distanceMeters: hit.distanceMeters } };
  }

  function handle(req, res, config, body, allowMetric) {
    const parsed = parseBody(body, { allowMetric });
    if (parsed.error) return sendError(res, 400, 'INVALID_REQUEST', parsed.error);
    try {
      const src = resolve(parsed.value.source, 'source');
      const dst = resolve(parsed.value.destination, 'destination');
      const metric = config.metric ?? parsed.value.metric ?? 'distance';
      const result = computeRoute(graph, { source: src.id, destination: dst.id, algorithm: config.algorithm, metric, includeDetails: parsed.value.includeDetails });
      const payload = { ...result, dataSource };
      if (src.snap || dst.snap) payload.snapped = { source: src.snap, destination: dst.snap };
      const respond = () => res.status(200).json(payload);
      if (onRoute && req.workspaceId) {
        const { labels } = parsed.value;
        const request = { source: parsed.value.source, destination: parsed.value.destination };
        return Promise.resolve()
          .then(() => onRoute({ workspaceId: req.workspaceId, request, labels, payload }))
          .catch((err) => console.error('[nexora] could not record route history:', err))
          .then(respond);
      }
      return respond();
    } catch (err) {
      if (err instanceof RouteError || err instanceof GraphError) {
        return sendError(res, STATUS_BY_CODE[err.code] ?? 400, err.code, err.message, err.details);
      }
      throw err;
    }
  }

  return {
    health: (_req, res) =>
      res.status(200).json({ status: 'ok', service: 'nexora-backend', uptimeSeconds: Math.round(process.uptime()), timestamp: new Date().toISOString() }),
    statistics: (_req, res) => res.status(200).json({ graph: graph.statistics(), heuristicScales: graph.getHeuristicScales(), dataSource }),
    shortest: (req, res) => handle(req, res, { algorithm: 'dijkstra', metric: 'distance' }, req.body, false),
    fastest: (req, res) => handle(req, res, { algorithm: 'dijkstra', metric: 'time' }, req.body, false),
    astar: (req, res) => handle(req, res, { algorithm: 'astar' }, req.body, true),
  };
}
