import { METRICS } from '../engine/pathUtils.js';

/** Limits shared by services, validators, docs and tests. */
export const LIMITS = {
  maxSavedRoutes: 200,
  maxHistoryRecords: 1000,
  nameMax: 80,
  placeLabelMax: 200,
  sessionLabelMax: 40,
};

export const ALGORITHMS = ['dijkstra', 'astar'];
export const DATA_SOURCES = ['osm', 'sample'];

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const SESSION_LABEL = /^[\p{L}\p{N} ._'-]+$/u;

/** Trim and collapse whitespace. @returns {string|null} null when the value is not a string */
export function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : null;
}

/** @returns {{value: string}|{error: string}} */
export function validateText(value, { field, min = 1, max }) {
  if (typeof value === 'string' && CONTROL_CHARS.test(value.replace(/[\t\r\n]/g, ' '))) return { error: `"${field}" contains unsupported characters` };
  const text = cleanText(value);
  if (text === null) return { error: `"${field}" must be text` };
  if (text.length < min) return { error: min === 1 ? `"${field}" is required` : `"${field}" must be at least ${min} characters` };
  if (text.length > max) return { error: `"${field}" must be at most ${max} characters` };
  return { value: text };
}

/** Optional operator label for a control session. Empty is allowed. */
export function validateSessionLabel(value) {
  if (value === undefined || value === null || value === '') return { value: '' };
  const r = validateText(value, { field: 'label', min: 1, max: LIMITS.sessionLabelMax });
  if (r.error) return r;
  if (!SESSION_LABEL.test(r.value)) return { error: '"label" may only contain letters, numbers, spaces and . _ \' -' };
  return r;
}

const round6 = (n) => Math.round(n * 1e6) / 1e6;

/** A place the route starts or ends at: `{label, lat, lng}`. */
export function validatePlace(value, field) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return { error: `"${field}" must be an object with label, lat and lng` };
  const label = validateText(value.label, { field: `${field}.label`, max: LIMITS.placeLabelMax });
  if (label.error) return label;
  const { lat, lng } = value;
  if (!Number.isFinite(lat) || Math.abs(lat) > 90) return { error: `"${field}.lat" must be a number between -90 and 90` };
  if (!Number.isFinite(lng) || Math.abs(lng) > 180) return { error: `"${field}.lng" must be a number between -180 and 180` };
  return { value: { label: label.value, lat: round6(lat), lng: round6(lng) } };
}

const finiteNonNegative = (n, max) => Number.isFinite(n) && n >= 0 && n <= max;

/** Body of POST /api/saved-routes. */
export function validateSavedRoute(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Request body must be a JSON object' };
  const name = validateText(body.name, { field: 'name', max: LIMITS.nameMax });
  if (name.error) return name;
  const source = validatePlace(body.source, 'source');
  if (source.error) return source;
  const destination = validatePlace(body.destination, 'destination');
  if (destination.error) return destination;
  if (!ALGORITHMS.includes(body.algorithm)) return { error: `"algorithm" must be one of: ${ALGORITHMS.join(', ')}` };
  if (!METRICS.includes(body.metric)) return { error: `"metric" must be one of: ${METRICS.join(', ')}` };
  if (!finiteNonNegative(body.distanceMeters, 1e8)) return { error: '"distanceMeters" must be a non-negative number' };
  const time = body.estimatedTimeSeconds ?? null;
  if (time !== null && !finiteNonNegative(time, 1e8)) return { error: '"estimatedTimeSeconds" must be a non-negative number or null' };
  const dataSource = body.dataSource ?? null;
  if (dataSource !== null && !DATA_SOURCES.includes(dataSource)) return { error: `"dataSource" must be one of: ${DATA_SOURCES.join(', ')}` };
  return {
    value: {
      name: name.value, source: source.value, destination: destination.value,
      algorithm: body.algorithm, metric: body.metric,
      distanceMeters: body.distanceMeters, estimatedTimeSeconds: time, dataSource,
    },
  };
}

/** Optional display labels sent with a route calculation: `{source?: string, destination?: string}`. */
export function validateRouteLabels(value) {
  if (value === undefined || value === null) return { value: {} };
  if (typeof value !== 'object' || Array.isArray(value)) return { error: '"labels" must be an object' };
  const out = {};
  for (const key of ['source', 'destination']) {
    if (value[key] === undefined) continue;
    const r = validateText(value[key], { field: `labels.${key}`, max: LIMITS.placeLabelMax });
    if (r.error) return r;
    out[key] = r.value;
  }
  return { value: out };
}

/** Parse a bounded integer query value. */
export function parseIntParam(raw, { field, min, max, fallback }) {
  if (raw === undefined || raw === '') return { value: fallback };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) return { error: `"${field}" must be an integer from ${min} to ${max}` };
  return { value: n };
}
