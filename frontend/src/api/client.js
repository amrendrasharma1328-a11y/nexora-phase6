import { activeWorkspaceId } from '../session/sessionStore.js';

/** Fired when the backend says the current control session is missing or unknown (see SessionContext). */
export const CONTROL_INVALID_EVENT = 'nexora:control-invalid';
export const WORKSPACE_HEADER = 'X-Nexora-Workspace';

/** Error thrown for non-2xx API responses (or unreachable backend). */
export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * @param {string} path
 * @param {RequestInit & {workspaceId?: string|null, silentControlErrors?: boolean}} [options]
 *   workspaceId overrides the stored session; silentControlErrors stops the "control lost" event for this call.
 */
async function request(path, { workspaceId, silentControlErrors = false, headers = {}, ...init } = {}) {
  const id = workspaceId === undefined ? activeWorkspaceId() : workspaceId;
  let res;
  try {
    res = await fetch(`/api${path}`, { ...init, headers: { ...headers, ...(id ? { [WORKSPACE_HEADER]: id } : {}) } });
  } catch {
    throw new ApiError('Cannot reach the NEXORA backend. Is it running?');
  }
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON body */ }
  if (!res.ok) {
    const code = body?.error?.code ?? 'HTTP_ERROR';
    if (res.status === 401 && !silentControlErrors && (code === 'CONTROL_INVALID' || code === 'CONTROL_REQUIRED')) {
      globalThis.window?.dispatchEvent(new CustomEvent(CONTROL_INVALID_EVENT, { detail: { code } }));
    }
    throw new ApiError(body?.error?.message ?? `Request failed (HTTP ${res.status})`, { status: res.status, code, details: body?.error?.details ?? null });
  }
  return body;
}

const send = (method) => (path, payload, options) =>
  request(path, { ...options, method, headers: { 'Content-Type': 'application/json' }, body: payload === undefined ? undefined : JSON.stringify(payload) });
const post = send('POST');

/** Place search (only call on explicit submit; the geocoder forbids autocomplete-style use). */
export const searchPlaces = (q) => request(`/search?q=${encodeURIComponent(q)}`);

export const getGraphStatistics = () => request('/graph/statistics');

/**
 * Calculate a route. When control is held, the backend also records the calculation in route history
 * (labels are the place names shown in the UI).
 * @param {{source: {lat: number, lng: number, label?: string}, destination: {lat: number, lng: number, label?: string},
 *   algorithm: 'dijkstra'|'astar', routeType: 'shortest'|'fastest'}} args
 */
export function calculateRoute({ source, destination, algorithm, routeType }) {
  const payload = {
    source: { lat: source.lat, lng: source.lng },
    destination: { lat: destination.lat, lng: destination.lng },
  };
  const labels = {};
  if (source.label) labels.source = source.label;
  if (destination.label) labels.destination = destination.label;
  if (Object.keys(labels).length) payload.labels = labels;
  if (algorithm === 'astar') return post('/routes/astar', { ...payload, metric: routeType === 'fastest' ? 'time' : 'distance' });
  return post(routeType === 'fastest' ? '/routes/fastest' : '/routes/shortest', payload);
}

/** Algorithm Lab: synthetic grid used for visualisation (not real roads). */
export const getLabGraph = (rows, cols) => request(`/lab/graph?rows=${rows}&cols=${cols}`);

/** Runs the REAL engine on the server and returns its recorded execution events. */
export const runLab = (payload) => post('/lab/run', payload);

/** Runs Dijkstra and A* on the same graph/pair. */
export const compareLab = (payload) => post('/lab/compare', payload);

// ---- Phase 6: control sessions, saved routes, history, analytics ----

/** Creates an anonymous workspace ("control session"). Not an account. */
export const requestControl = (label) => post('/session', label ? { label } : {}, { workspaceId: null });
/** Checks a workspace id (defaults to the stored one). */
export const getSession = (workspaceId) => request('/session', { workspaceId, silentControlErrors: true });
/** Permanently erases the current workspace and everything in it. */
export const eraseWorkspace = () => request('/session', { method: 'DELETE' });

export const listSavedRoutes = () => request('/saved-routes');
/** @param {{name: string, source: object, destination: object, algorithm: string, metric: string, distanceMeters: number, estimatedTimeSeconds: number|null, dataSource?: string}} route */
export const saveRoute = (route) => post('/saved-routes', route);
export const deleteSavedRoute = (id) => request(`/saved-routes/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** @param {{limit?: number, offset?: number, algorithm?: 'dijkstra'|'astar'}} [params] */
export function listHistory({ limit = 25, offset = 0, algorithm } = {}) {
  const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (algorithm) q.set('algorithm', algorithm);
  return request(`/history?${q}`);
}
export const clearHistory = () => request('/history', { method: 'DELETE' });

/** @param {'7d'|'30d'|'90d'|'all'} range Days are bucketed in the browser's local time zone. */
export function getAnalytics(range = '30d') {
  const tz = -new Date().getTimezoneOffset(); // minutes east of UTC
  return request(`/analytics?range=${range}&tz=${tz}`);
}
