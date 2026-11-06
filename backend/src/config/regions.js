/**
 * Configurable demonstration regions. Lucknow is only the default demo region;
 * nothing else in the code depends on it. Add regions here, or override with env vars:
 *   NEXORA_REGION=<id>                          pick a region from the table
 *   NEXORA_BBOX="south,west,north,east"         custom bounding box (then also NEXORA_REGION_NAME)
 */
export const REGIONS = {
  lucknow: {
    id: 'lucknow',
    name: 'Lucknow, Uttar Pradesh, India',
    // Central Lucknow. Deliberately modest in size so the Overpass request stays reasonable.
    bbox: { south: 26.82, west: 80.9, north: 26.9, east: 81.0 },
  },
};

/** @returns {{south: number, west: number, north: number, east: number}} */
export function parseBbox(text) {
  const parts = String(text).split(',').map((x) => Number(x.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error('Bounding box must be "south,west,north,east" (4 numbers)');
  }
  const [south, west, north, east] = parts;
  if (south >= north || west >= east || Math.abs(south) > 90 || Math.abs(north) > 90 || Math.abs(west) > 180 || Math.abs(east) > 180) {
    throw new Error('Bounding box is invalid (need south < north, west < east, valid lat/lng)');
  }
  return { south, west, north, east };
}

/** @param {NodeJS.ProcessEnv} [env] */
export function resolveRegion(env = process.env) {
  if (env.NEXORA_BBOX) {
    const bbox = parseBbox(env.NEXORA_BBOX);
    const id = (env.NEXORA_REGION || 'custom').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    return { id, name: env.NEXORA_REGION_NAME || id, bbox };
  }
  const id = (env.NEXORA_REGION || 'lucknow').toLowerCase();
  const region = REGIONS[id];
  if (!region) throw new Error(`Unknown region "${id}". Known: ${Object.keys(REGIONS).join(', ')} (or set NEXORA_BBOX)`);
  return region;
}
