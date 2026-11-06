import { RouteError, GraphError } from '../engine/errors.js';
import { METRICS } from '../engine/pathUtils.js';
import { LAB_LIMITS, LAB_DATA_SOURCE } from '../services/labService.js';

const sendError = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const isSize = (n) => Number.isInteger(n) && n >= LAB_LIMITS.minSize && n <= LAB_LIMITS.maxSize;
const isId = (x) => typeof x === 'string' && x.trim() !== '';

function parseSize(rowsRaw, colsRaw) {
  const rows = rowsRaw === undefined ? LAB_LIMITS.defaultSize : Number(rowsRaw);
  const cols = colsRaw === undefined ? rows : Number(colsRaw);
  if (!isSize(rows) || !isSize(cols)) return { error: `rows and cols must be integers from ${LAB_LIMITS.minSize} to ${LAB_LIMITS.maxSize}` };
  return { rows, cols };
}

/** @param {{lab: ReturnType<import('../services/labService.js').createLabService>}} deps */
export function createLabController({ lab }) {
  function parseRun(body, { needsAlgorithm }) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Request body must be a JSON object' };
    const size = parseSize(body.rows, body.cols);
    if (size.error) return size;
    if (!isId(body.source) || !isId(body.destination)) return { error: '"source" and "destination" are required vertex ids' };
    if (needsAlgorithm && !['dijkstra', 'astar'].includes(body.algorithm)) return { error: '"algorithm" must be "dijkstra" or "astar"' };
    const metric = body.metric ?? 'distance';
    if (!METRICS.includes(metric)) return { error: `"metric" must be one of: ${METRICS.join(', ')}` };
    return { value: { ...size, source: body.source, destination: body.destination, algorithm: body.algorithm, metric } };
  }

  function guard(res, fn) {
    try { return fn(); } catch (err) {
      if (err instanceof RouteError || err instanceof GraphError) {
        return sendError(res, err.code === 'INVALID_VERTEX' ? 404 : 400, err.code, err.message);
      }
      throw err;
    }
  }

  return {
    graph(req, res) {
      const size = parseSize(req.query.rows, req.query.cols);
      if (size.error) return sendError(res, 400, 'INVALID_REQUEST', size.error);
      return res.status(200).json(lab.describeGraph(size.rows, size.cols));
    },
    run(req, res) {
      const p = parseRun(req.body, { needsAlgorithm: true });
      if (p.error) return sendError(res, 400, 'INVALID_REQUEST', p.error);
      return guard(res, () => res.status(200).json({ ...lab.runTraced(p.value), dataSource: LAB_DATA_SOURCE }));
    },
    compare(req, res) {
      const p = parseRun(req.body, { needsAlgorithm: false });
      if (p.error) return sendError(res, 400, 'INVALID_REQUEST', p.error);
      return guard(res, () => res.status(200).json({ ...lab.compare(p.value), dataSource: LAB_DATA_SOURCE }));
    },
  };
}
