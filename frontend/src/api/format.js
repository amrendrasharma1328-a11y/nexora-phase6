const FEET_PER_METER = 3.28084;
const METERS_PER_MILE = 1609.344;

/** @param {number|null|undefined} meters @param {'km'|'mi'} [units] */
export function formatDistance(meters, units = 'km') {
  if (!Number.isFinite(meters)) return '—';
  if (units === 'mi') {
    return meters < 160.9344 ? `${Math.round(meters * FEET_PER_METER)} ft` : `${(meters / METERS_PER_MILE).toFixed(2)} mi`;
  }
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`;
}

/** Distance as a plain number in the chosen large unit (km or mi), for chart axes. */
export function distanceInUnit(meters, units = 'km') {
  if (!Number.isFinite(meters)) return null;
  return units === 'mi' ? meters / METERS_PER_MILE : meters / 1000;
}

export const unitLabel = (units) => (units === 'mi' ? 'mi' : 'km');

/** @param {number|null|undefined} seconds */
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const mins = Math.round(seconds / 60);
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

/** Algorithm execution time in milliseconds. */
export function formatMs(ms) {
  if (!Number.isFinite(ms)) return '—';
  return `${ms < 10 ? ms.toFixed(2) : ms < 100 ? ms.toFixed(1) : Math.round(ms)} ms`;
}

/** Local date and time, e.g. "5 Nov 2026, 3:42 pm". */
export function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export const formatPercent = (fraction) => (Number.isFinite(fraction) ? `${Math.round(fraction * 100)}%` : '—');

export const ALGORITHM_NAMES = { dijkstra: 'Dijkstra', astar: 'A*' };
export const algorithmName = (id) => ALGORITHM_NAMES[id] ?? id;
