import { haversineMeters } from '../engine/geo.js';

/**
 * Uniform-grid spatial index over graph vertices for nearest-vertex lookup
 * (snapping a clicked/geocoded coordinate to the road network).
 * Limitation: snaps to the nearest INTERSECTION vertex, not to the nearest point on a road segment.
 */
export class SpatialIndex {
  /** @param {import('../engine/Graph.js').Graph} graph @param {{cellDegrees?: number}} [options] */
  constructor(graph, { cellDegrees = 0.002 } = {}) {
    this.graph = graph;
    this.cell = cellDegrees;
    /** @type {Map<string, string[]>} */
    this.cells = new Map();
    this.count = 0;
    for (const v of graph.vertices.values()) {
      if (v.lat === undefined) continue;
      const key = this.key(v.lat, v.lng);
      if (!this.cells.has(key)) this.cells.set(key, []);
      this.cells.get(key).push(v.id);
      this.count += 1;
    }
  }

  key(lat, lng) {
    return `${Math.floor(lat / this.cell)}:${Math.floor(lng / this.cell)}`;
  }

  /**
   * @param {{lat: number, lng: number}} point
   * @param {{maxMeters?: number}} [options]
   * @returns {{id: string, distanceMeters: number}|null}
   */
  nearest(point, { maxMeters = 500 } = {}) {
    if (this.count === 0 || !Number.isFinite(point?.lat) || !Number.isFinite(point?.lng)) return null;
    const cellMeters = this.cell * 111320 * Math.max(0.1, Math.cos((point.lat * Math.PI) / 180));
    const maxRing = Math.ceil(maxMeters / cellMeters) + 1;
    const ci = Math.floor(point.lat / this.cell);
    const cj = Math.floor(point.lng / this.cell);
    let best = null;
    const scan = (i, j) => {
      const ids = this.cells.get(`${i}:${j}`);
      if (!ids) return;
      for (const id of ids) {
        const d = haversineMeters(point, this.graph.getVertex(id));
        if (!best || d < best.distanceMeters) best = { id, distanceMeters: d };
      }
    };
    for (let r = 0; r <= maxRing; r += 1) {
      // Visit only the cells on the square ring at Chebyshev distance r.
      if (r === 0) scan(ci, cj);
      else {
        for (let i = ci - r; i <= ci + r; i += 1) {
          if (i === ci - r || i === ci + r) for (let j = cj - r; j <= cj + r; j += 1) scan(i, j);
          else { scan(i, cj - r); scan(i, cj + r); }
        }
      }
      if (best && best.distanceMeters <= r * cellMeters) break; // nothing closer can exist in outer rings
    }
    return best && best.distanceMeters <= maxMeters ? best : null;
  }
}
