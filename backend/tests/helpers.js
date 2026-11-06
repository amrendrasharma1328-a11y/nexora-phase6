import { Graph } from '../src/engine/Graph.js';
import { haversineMeters } from '../src/engine/geo.js';

/** Run fn and return the thrown error's `code` (or null if nothing was thrown). */
export function errorCode(fn) {
  try { fn(); } catch (e) { return e.code ?? e.name; }
  return null;
}

/** Small abstract graph without coordinates (textbook example). */
export function textbookGraph() {
  const g = new Graph({ name: 'textbook' });
  for (const id of ['A', 'B', 'C', 'D', 'E', 'F']) g.addVertex(id);
  g.addBidirectionalEdge('A', 'B', 7, { time: 70 });
  g.addBidirectionalEdge('A', 'C', 9, { time: 20 });
  g.addBidirectionalEdge('A', 'F', 14, { time: 10 });
  g.addBidirectionalEdge('B', 'C', 10, { time: 10 });
  g.addBidirectionalEdge('B', 'D', 15, { time: 15 });
  g.addBidirectionalEdge('C', 'D', 11, { time: 11 });
  g.addBidirectionalEdge('C', 'F', 2, { time: 90 });
  g.addBidirectionalEdge('D', 'E', 6, { time: 6 });
  g.addBidirectionalEdge('E', 'F', 9, { time: 9 });
  return g;
}

/** Deterministic PRNG so tests are reproducible. */
export function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random geographic graph: edge distance >= straight line; random one-way/two-way edges. */
export function randomGeoGraph(seed, n = 40, edgesPerNode = 3) {
  const rnd = mulberry32(seed);
  const g = new Graph({ name: `random-${seed}` });
  for (let i = 0; i < n; i += 1) g.addVertex(`v${i}`, { lat: 26.8 + rnd() * 0.05, lng: 80.9 + rnd() * 0.05 });
  for (let i = 0; i < n; i += 1) {
    for (let k = 0; k < edgesPerNode; k += 1) {
      const j = Math.floor(rnd() * n);
      if (j === i) continue;
      const straight = haversineMeters(g.getVertex(`v${i}`), g.getVertex(`v${j}`));
      const dist = straight * (1 + rnd() * 0.6);
      const speed = 5 + rnd() * 20;
      g.addEdge(`v${i}`, `v${j}`, dist, { bidirectional: rnd() < 0.5, time: dist / speed });
    }
  }
  return g;
}
