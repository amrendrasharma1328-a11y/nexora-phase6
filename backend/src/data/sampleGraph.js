import { Graph } from '../engine/Graph.js';
import { haversineMeters } from '../engine/geo.js';

export const SAMPLE_DATA_SOURCE = {
  type: 'sample',
  description:
    'Synthetic grid graph generated in code for development and tests. It is NOT real road data. ' +
    'Travel times are estimates from assumed speeds, not live traffic.',
};

/** Deterministic pseudo-random detour factor in [1.00, 1.35] (no Math.random: reproducible). */
function detourFactor(a, b) {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return 1 + (x - Math.floor(x)) * 0.35;
}

/**
 * Build a synthetic rows x cols street grid.
 * - Vertex ids: "N<row>-<col>".
 * - Every 3rd row/column is a "main" road (50 km/h); the rest are "local" (30 km/h).
 * - Edge distance = straight-line meters * detour factor (>= 1), so it is never shorter than a straight line.
 * - Column 1 is one-way southbound; row 4 (if present) is one-way eastbound; one block is closed.
 * - A fast "express" link joins N0-0 and N3-3 (both ways) when the grid is big enough.
 * - Two extra vertices (ISOLATED, X1-X2 island) exist to exercise unreachable-destination handling.
 * @param {{rows?: number, cols?: number, includeExtras?: boolean}} [options]
 */
export function createSampleGraph({ rows = 6, cols = 6, includeExtras = true } = {}) {
  const graph = new Graph({ name: `sample-grid-${rows}x${cols}` });
  const base = { lat: 26.85, lng: 80.95 };
  const step = { lat: 0.002, lng: 0.00225 };
  const id = (r, c) => `N${r}-${c}`;

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      graph.addVertex(id(r, c), { lat: base.lat + r * step.lat, lng: base.lng + c * step.lng });
    }
  }

  const roadSpeedMps = (r1, c1, r2, c2) => {
    const main = (r1 === r2 && r1 % 3 === 0) || (c1 === c2 && c1 % 3 === 0);
    return (main ? 50 : 30) / 3.6;
  };

  const link = (r1, c1, r2, c2, oneWay) => {
    const a = id(r1, c1);
    const b = id(r2, c2);
    const meters = haversineMeters(graph.getVertex(a), graph.getVertex(b)) * detourFactor(r1 * cols + c1, r2 * cols + c2);
    const speed = roadSpeedMps(r1, c1, r2, c2);
    const main = speed > 10;
    graph.addEdge(a, b, meters, { bidirectional: !oneWay, time: meters / speed, roadType: main ? 'main' : 'local', name: `${a}~${b}` });
  };

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (c + 1 < cols) {
        const closed = r === 2 && c === 2 && rows > 3 && cols > 3; // closed block
        const eastOnly = r === 4 && rows > 4;
        if (!closed) link(r, c, r, c + 1, eastOnly);
      }
      if (r + 1 < rows) link(r, c, r + 1, c, c === 1 && cols > 1); // column 1: southbound only
    }
  }

  if (rows > 3 && cols > 3) {
    const meters = haversineMeters(graph.getVertex(id(0, 0)), graph.getVertex(id(3, 3))) * 1.02;
    graph.addBidirectionalEdge(id(0, 0), id(3, 3), meters, { time: meters / (80 / 3.6), roadType: 'express', name: 'express-link' });
  }

  if (includeExtras) {
    graph.addVertex('ISOLATED', { lat: base.lat - 0.01, lng: base.lng - 0.01 });
    graph.addVertex('X1', { lat: base.lat - 0.02, lng: base.lng });
    graph.addVertex('X2', { lat: base.lat - 0.02, lng: base.lng + 0.002 });
    const m = haversineMeters(graph.getVertex('X1'), graph.getVertex('X2')) * 1.1;
    graph.addBidirectionalEdge('X1', 'X2', m, { time: m / (30 / 3.6), roadType: 'local' });
  }
  return graph;
}
