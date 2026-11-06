import { buildGraphFromOsm } from './buildGraph.js';
import { loadCache } from './overpassClient.js';
import { createSampleGraph, SAMPLE_DATA_SOURCE } from '../data/sampleGraph.js';

/**
 * Load the routing graph for a region.
 * mode: "osm" (require cached OSM data), "sample" (synthetic grid), "auto" (OSM if cached, else sample).
 * The returned `dataSource` always says truthfully which one is in use.
 */
export async function loadGraphForRegion({ region, mode = process.env.NEXORA_GRAPH || 'auto', logger = console, cacheDir } = {}) {
  if (mode !== 'sample') {
    const cached = await loadCache(region.id, { dir: cacheDir });
    if (cached) {
      const { graph, stats } = buildGraphFromOsm(cached.osm, { name: `osm-${region.id}` });
      return {
        graph,
        dataSource: {
          type: 'osm',
          region: region.name,
          bbox: cached.meta.bbox,
          fetchedAt: cached.meta.fetchedAt,
          attribution: '© OpenStreetMap contributors',
          license: 'Open Database License (ODbL) 1.0',
          buildStats: stats,
          notes: [
            'OpenStreetMap road data. This is NOT live traffic data.',
            'Estimated travel time uses maxspeed tags or assumed class speeds.',
            'Turn restrictions and time-based restrictions are not modelled.',
          ],
        },
      };
    }
    if (mode === 'osm') throw new Error(`No cached OSM data for region "${region.id}". Run: npm run fetch-osm`);
    logger.warn(`[nexora] No cached OSM data for "${region.id}" - using the SYNTHETIC sample graph. Run "npm run fetch-osm" to download real roads.`);
  }
  return { graph: createSampleGraph(), dataSource: SAMPLE_DATA_SOURCE };
}
