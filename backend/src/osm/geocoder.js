/** Error from the geocoding layer. `status` is the HTTP status the API should return. */
export class GeocodingError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'GeocodingError';
    this.code = code;
    this.status = status;
  }
}

export const DEFAULT_NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
export const GEOCODING_ATTRIBUTION = 'Search data © OpenStreetMap contributors (Nominatim, ODbL)';

/**
 * Nominatim-backed place search that follows the public usage policy:
 *  - identifying User-Agent (set NOMINATIM_USER_AGENT with your contact details),
 *  - at most 1 request/second (serialised queue + minimum interval),
 *  - result caching,
 *  - no autocomplete: the API only searches when the caller explicitly submits.
 * For anything beyond light use, run your own Nominatim or use a commercial geocoder (set NOMINATIM_URL).
 *
 * @param {{baseUrl?: string, userAgent?: string, bbox?: {south:number,west:number,north:number,east:number},
 *   fetchImpl?: typeof fetch, minIntervalMs?: number, cacheTtlMs?: number, cacheSize?: number,
 *   now?: () => number, sleep?: (ms: number) => Promise<void>}} [options]
 */
export function createGeocoder({
  baseUrl = process.env.NOMINATIM_URL || DEFAULT_NOMINATIM_URL,
  userAgent = process.env.NOMINATIM_USER_AGENT || 'NEXORA-student-project/0.1 (set NOMINATIM_USER_AGENT with contact info)',
  bbox = null,
  fetchImpl = fetch,
  minIntervalMs = 1100,
  cacheTtlMs = 10 * 60 * 1000,
  cacheSize = 200,
  now = () => Date.now(),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  const cache = new Map();
  let chain = Promise.resolve();
  let lastRequestAt = -Infinity;

  const enqueue = (task) => {
    const run = chain.then(task, task);
    chain = run.catch(() => {});
    return run;
  };

  const inBbox = (r) => !bbox || (r.lat >= bbox.south && r.lat <= bbox.north && r.lng >= bbox.west && r.lng <= bbox.east);

  async function request(q) {
    const wait = lastRequestAt + minIntervalMs - now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = now();
    const params = new URLSearchParams({ format: 'jsonv2', q, limit: '8', addressdetails: '0', 'accept-language': 'en' });
    if (bbox) { params.set('viewbox', `${bbox.west},${bbox.north},${bbox.east},${bbox.south}`); params.set('bounded', '1'); }
    let res;
    try {
      res = await fetchImpl(`${baseUrl}/search?${params}`, { headers: { 'User-Agent': userAgent, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
    } catch {
      throw new GeocodingError('GEOCODER_UNAVAILABLE', 'Geocoding service is unreachable', 502);
    }
    if (res.status === 429) throw new GeocodingError('GEOCODER_RATE_LIMITED', 'Geocoding service rate limit reached; try again shortly', 503);
    if (!res.ok) throw new GeocodingError('GEOCODER_ERROR', `Geocoding service returned HTTP ${res.status}`, 502);
    const data = await res.json();
    if (!Array.isArray(data)) throw new GeocodingError('GEOCODER_ERROR', 'Unexpected geocoding response', 502);
    return data
      .map((d) => ({ displayName: d.display_name, lat: Number(d.lat), lng: Number(d.lon), category: d.category ?? d.class ?? null, type: d.type ?? null, osmType: d.osm_type ?? null, osmId: d.osm_id ?? null }))
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng) && inBbox(r));
  }

  return {
    /** @param {string} query @returns {Promise<{displayName: string, lat: number, lng: number}[]>} */
    async search(query) {
      const q = typeof query === 'string' ? query.trim() : '';
      if (q.length < 2 || q.length > 200) throw new GeocodingError('INVALID_QUERY', 'Query must be 2 to 200 characters', 400);
      const key = q.toLowerCase();
      const hit = cache.get(key);
      if (hit && now() - hit.at < cacheTtlMs) return hit.results;
      const results = await enqueue(() => request(q));
      cache.set(key, { at: now(), results });
      if (cache.size > cacheSize) cache.delete(cache.keys().next().value);
      return results;
    },
  };
}
