// Usage: node scripts/fetch-osm.js [--refresh]
// Downloads drivable roads for the configured region from Overpass ONCE and caches them on disk.
import { resolveRegion } from '../src/config/regions.js';
import { fetchRoadNetwork, loadCache, saveCache, cachePath } from '../src/osm/overpassClient.js';

const region = resolveRegion();
const refresh = process.argv.includes('--refresh');

if (!refresh && (await loadCache(region.id))) {
  console.log(`Cache already exists: ${cachePath(region.id)}\nUse --refresh to download again (please do not refetch needlessly).`);
  process.exit(0);
}
console.log(`Fetching roads for "${region.name}" bbox=${JSON.stringify(region.bbox)} ...\n(one request to Overpass; this can take a minute or more)`);
const osm = await fetchRoadNetwork(region.bbox);
const file = await saveCache(region.id, region, osm);
const ways = osm.elements.filter((e) => e.type === 'way').length;
const nodes = osm.elements.filter((e) => e.type === 'node').length;
console.log(`Saved ${ways} ways and ${nodes} nodes to ${file}\nData © OpenStreetMap contributors (ODbL).`);
