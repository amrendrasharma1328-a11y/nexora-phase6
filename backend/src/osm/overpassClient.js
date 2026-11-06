import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DRIVABLE_HIGHWAYS } from './roadClasses.js';

export const DEFAULT_OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

/** Build an Overpass QL query for drivable roads inside a bounding box. */
export function buildOverpassQuery({ south, west, north, east }, { timeoutSeconds = 180 } = {}) {
  const classes = Object.keys(DRIVABLE_HIGHWAYS).join('|');
  return `[out:json][timeout:${timeoutSeconds}];
(
  way["highway"~"^(${classes})$"](${south},${west},${north},${east});
);
(._;>;);
out body;`;
}

/**
 * Download road data from Overpass (ONE request). Follow the Overpass usage policy:
 * identify yourself, do not hammer the server, cache the result (see cache helpers below).
 * @param {{south:number,west:number,north:number,east:number}} bbox
 * @param {{endpoint?: string, userAgent?: string, timeoutMs?: number, fetchImpl?: typeof fetch}} [options]
 */
export async function fetchRoadNetwork(bbox, { endpoint = process.env.OVERPASS_URL || DEFAULT_OVERPASS_URL, userAgent = process.env.OVERPASS_USER_AGENT || 'NEXORA-student-project/0.1 (set OVERPASS_USER_AGENT with contact info)', timeoutMs = 240000, fetchImpl = fetch } = {}) {
  const res = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': userAgent, Accept: 'application/json' },
    body: `data=${encodeURIComponent(buildOverpassQuery(bbox))}`,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status === 429) throw new Error('Overpass rate limit (HTTP 429). Wait a few minutes and retry.');
  if (!res.ok) throw new Error(`Overpass request failed: HTTP ${res.status}`);
  const json = await res.json();
  if (json.remark && /error|timed out|out of memory/i.test(json.remark)) throw new Error(`Overpass reported: ${json.remark}. Try a smaller bounding box.`);
  if (!Array.isArray(json.elements)) throw new Error('Unexpected Overpass response (no "elements" array)');
  return json;
}

export const cachePath = (regionId, dir = path.resolve(import.meta.dirname, '../../data/cache')) => path.join(dir, `${regionId}.overpass.json`);

/** Save downloaded data together with provenance metadata. */
export async function saveCache(regionId, region, osm, { endpoint = DEFAULT_OVERPASS_URL, dir } = {}) {
  const file = cachePath(regionId, dir);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ meta: { regionId, regionName: region.name, bbox: region.bbox, fetchedAt: new Date().toISOString(), endpoint }, osm }));
  return file;
}

/** @returns {Promise<{meta: object, osm: object}|null>} null if no cache file exists */
export async function loadCache(regionId, { dir } = {}) {
  try {
    return JSON.parse(await readFile(cachePath(regionId, dir), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}
