import { HttpError, asyncHandler } from '../http/httpError.js';
import { ALGORITHMS, parseIntParam } from '../validation/inputs.js';
import { RANGES, computeAnalytics } from '../services/analyticsService.js';

const fail = (message) => { throw new HttpError(400, 'INVALID_REQUEST', message); };

/**
 * HTTP layer for control sessions, saved routes, history and analytics.
 * Validation of bodies lives in services/validation; this layer parses query strings and shapes responses.
 * @param {{workspaces: object, savedRoutes: object, history: object, now?: () => number}} deps
 */
export function createWorkspaceController({ workspaces, savedRoutes, history, now = Date.now }) {
  return {
    requestControl: asyncHandler(async (req, res) => res.status(201).json(await workspaces.requestControl(req.body))),
    session: asyncHandler(async (req, res) => res.status(200).json(await workspaces.describe(req.workspaceId))),
    eraseSession: asyncHandler(async (req, res) => res.status(200).json(await workspaces.erase(req.workspaceId))),

    listSaved: asyncHandler(async (req, res) => res.status(200).json(await savedRoutes.list(req.workspaceId))),
    createSaved: asyncHandler(async (req, res) => res.status(201).json(await savedRoutes.create(req.workspaceId, req.body))),
    getSaved: asyncHandler(async (req, res) => res.status(200).json(await savedRoutes.get(req.workspaceId, req.params.id))),
    deleteSaved: asyncHandler(async (req, res) => res.status(200).json(await savedRoutes.remove(req.workspaceId, req.params.id))),

    listHistory: asyncHandler(async (req, res) => {
      const limit = parseIntParam(req.query.limit, { field: 'limit', min: 1, max: 100, fallback: 25 });
      const offset = parseIntParam(req.query.offset, { field: 'offset', min: 0, max: 1_000_000, fallback: 0 });
      if (limit.error) fail(limit.error);
      if (offset.error) fail(offset.error);
      const { algorithm } = req.query;
      if (algorithm !== undefined && !ALGORITHMS.includes(algorithm)) fail(`"algorithm" must be one of: ${ALGORITHMS.join(', ')}`);
      res.status(200).json(await history.list(req.workspaceId, { limit: limit.value, offset: offset.value, algorithm }));
    }),
    clearHistory: asyncHandler(async (req, res) => res.status(200).json(await history.clear(req.workspaceId))),

    analytics: asyncHandler(async (req, res) => {
      const range = req.query.range ?? '30d';
      if (!Object.hasOwn(RANGES, range)) fail(`"range" must be one of: ${Object.keys(RANGES).join(', ')}`);
      const tz = parseIntParam(req.query.tz, { field: 'tz', min: -840, max: 840, fallback: 0 });
      if (tz.error) fail(tz.error);
      const { history: records, savedCount } = await history.all(req.workspaceId);
      res.status(200).json(computeAnalytics(records, { range, nowMs: now(), tzOffsetMinutes: tz.value, savedRoutes: savedCount }));
    }),
  };
}
