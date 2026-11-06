/** Road classes used for routing and their ASSUMED default speeds (km/h). Not measured data. */
export const DRIVABLE_HIGHWAYS = {
  motorway: 70, motorway_link: 45,
  trunk: 55, trunk_link: 40,
  primary: 45, primary_link: 35,
  secondary: 40, secondary_link: 30,
  tertiary: 35, tertiary_link: 30,
  unclassified: 30, residential: 25, living_street: 12, service: 15,
};

const EXCLUDED_SERVICE = new Set(['parking_aisle', 'driveway', 'emergency_access', 'drive-through']);
const BLOCKED = new Set(['no', 'private']);

/** @returns {string|null} reason this way is NOT routable for cars, or null if it is */
export function exclusionReason(tags = {}) {
  if (!Object.hasOwn(DRIVABLE_HIGHWAYS, tags.highway)) return 'not-drivable-class';
  if (tags.area === 'yes') return 'area';
  if (tags.highway === 'service' && EXCLUDED_SERVICE.has(tags.service)) return 'service-type';
  // Most specific tag wins: motor_vehicle > vehicle > access.
  for (const key of ['motor_vehicle', 'vehicle', 'access']) {
    if (tags[key] !== undefined) return BLOCKED.has(tags[key]) ? `access-${key}` : null;
  }
  return null;
}

/**
 * Travel direction allowed for motor vehicles.
 * @returns {'forward'|'backward'|'both'}
 */
export function travelDirection(tags = {}) {
  const o = tags.oneway;
  if (o === 'yes' || o === 'true' || o === '1') return 'forward';
  if (o === '-1' || o === 'reverse') return 'backward';
  if (o === 'no' || o === 'false' || o === '0') return 'both';
  if (tags.junction === 'roundabout' || tags.junction === 'circular') return 'forward';
  if (tags.highway === 'motorway' || tags.highway === 'motorway_link') return 'forward';
  return 'both';
}

/** Parse an OSM maxspeed value into km/h, or null if absent/unusable ("signals", "none", ...). */
export function parseMaxspeedKmh(value) {
  if (typeof value !== 'string') return null;
  const m = value.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(mph|km\/h|kmh|kph)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  const kmh = m[2] === 'mph' ? n * 1.609344 : n;
  return kmh > 0 && kmh <= 200 ? kmh : null;
}

/** @returns {number} speed in km/h (explicit maxspeed if usable, else assumed class default) */
export function speedKmh(tags) {
  return parseMaxspeedKmh(tags.maxspeed) ?? DRIVABLE_HIGHWAYS[tags.highway];
}
