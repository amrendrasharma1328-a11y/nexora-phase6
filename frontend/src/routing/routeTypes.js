/** The planner talks about "route types" (shortest/fastest); the API and storage use metrics (distance/time). */
export const metricToRouteType = (metric) => (metric === 'time' ? 'fastest' : 'shortest');
export const routeTypeToMetric = (routeType) => (routeType === 'fastest' ? 'time' : 'distance');
export const routeTypeLabel = (routeType) => (routeType === 'fastest' ? 'Fastest' : 'Shortest');
export const metricLabel = (metric) => routeTypeLabel(metricToRouteType(metric));

/** True when two places are the same spot (about 1 m apart). */
export function samePlace(a, b) {
  return Math.abs(a.lat - b.lat) < 1e-5 && Math.abs(a.lng - b.lng) < 1e-5;
}

/** Default saved-route name, within the 80 character limit. */
export function defaultRouteName(source, destination, max = 80) {
  const short = (s) => s.split(',')[0].trim();
  const name = `${short(source.label)} to ${short(destination.label)}`;
  return name.length <= max ? name : `${name.slice(0, max - 1)}…`;
}
