import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { resolveRegion } from './config/regions.js';
import { loadGraphForRegion } from './osm/loadGraph.js';
import { createWorkspaceStore } from './store/workspaceStore.js';

const PORT = Number(process.env.PORT) || 5000;
const region = resolveRegion();
const started = performance.now();
const { graph, dataSource } = await loadGraphForRegion({ region });
const s = graph.statistics();
console.log(`[nexora] graph "${graph.name}" (${dataSource.type}): ${s.vertexCount} vertices, ${s.edgeCount} edges, loaded in ${Math.round(performance.now() - started)} ms`);

// Saved routes / history / control sessions. NEXORA_STORE=memory disables persistence (data is lost on restart).
const defaultDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'workspaces');
const storeMode = process.env.NEXORA_STORE === 'memory' ? 'memory' : 'file';
const dataDir = path.resolve(process.env.NEXORA_DATA_DIR || defaultDir);
const store = createWorkspaceStore({ dir: storeMode === 'file' ? dataDir : null });
console.log(`[nexora] workspace store: ${storeMode === 'file' ? `files in ${dataDir}` : 'in-memory (not persistent)'}`);

createApp({ graph, dataSource, region, store }).listen(PORT, () => {
  console.log(`NEXORA backend listening on http://localhost:${PORT}`);
});
