// Usage: node scripts/benchmark.js [size=150] [pairs=40]
import { createSampleGraph } from '../src/data/sampleGraph.js';
import { dijkstra } from '../src/engine/dijkstra.js';
import { aStar } from '../src/engine/astar.js';

const size = Number(process.argv[2]) || 150;
const pairs = Number(process.argv[3]) || 40;
const t0 = performance.now();
const g = createSampleGraph({ rows: size, cols: size, includeExtras: false });
const buildMs = performance.now() - t0;
const ids = g.getVertexIds();
let seed = 42;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

const agg = { dijkstra: { ms: 0, visited: 0, found: 0 }, astar: { ms: 0, visited: 0, found: 0 } };
let mismatches = 0;
for (let i = 0; i < pairs; i += 1) {
  const s = ids[Math.floor(rnd() * ids.length)];
  const t = ids[Math.floor(rnd() * ids.length)];
  const d = dijkstra(g, s, t, { collectExploredEdges: false });
  const a = aStar(g, s, t, { collectExploredEdges: false });
  for (const [k, r] of [['dijkstra', d], ['astar', a]]) { agg[k].ms += r.executionTimeMs; agg[k].visited += r.stats.nodesVisited; agg[k].found += r.found ? 1 : 0; }
  if (d.found !== a.found || (d.found && Math.abs(d.cost - a.cost) > 1e-6)) mismatches += 1;
}
console.log(JSON.stringify({
  vertices: g.vertices.size, edges: g.edgeCount, buildMs: +buildMs.toFixed(1), pairs, costMismatches: mismatches,
  dijkstra: { avgMs: +(agg.dijkstra.ms / pairs).toFixed(2), avgVisited: Math.round(agg.dijkstra.visited / pairs), found: agg.dijkstra.found },
  astar: { avgMs: +(agg.astar.ms / pairs).toFixed(2), avgVisited: Math.round(agg.astar.visited / pairs), found: agg.astar.found },
}, null, 2));
