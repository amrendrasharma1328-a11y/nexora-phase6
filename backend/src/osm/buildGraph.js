import { Graph } from '../engine/Graph.js';
import { haversineMeters } from '../engine/geo.js';
import { largestComponent } from '../engine/scc.js';
import { exclusionReason, travelDirection, speedKmh } from './roadClasses.js';

const lengthOf = (points) => {
  let d = 0;
  for (let i = 1; i < points.length; i += 1) d += haversineMeters(points[i - 1], points[i]);
  return d;
};

/**
 * Convert Overpass/OSM JSON (nodes + ways) into a routable directed Graph.
 *
 * Rules (important for realism):
 *  - Vertices are ONLY real intersections/endpoints: OSM nodes shared by 2+ road occurrences or
 *    ending a way. Roads that merely cross or run close together are NOT connected (e.g. bridges).
 *  - Each edge is a road segment between two vertices; its distance is the length of the road
 *    geometry (sum of Haversine over every shape point), not the straight line.
 *  - One-way tags (oneway=yes/-1, roundabouts, motorways) produce a single directed edge.
 *  - Ways closed to cars (access/motor_vehicle/vehicle = no/private) and non-drivable classes are skipped.
 *  - Time = distance / (maxspeed tag or assumed class speed). Estimate only, not live traffic.
 *  - Optionally keeps only the largest strongly connected component so every kept vertex can reach
 *    every other (drops one-way dead-end pockets and disconnected fragments).
 *  - Turn restrictions (relations) are NOT modelled.
 *
 * @param {{elements: object[]}} osm
 * @param {{name?: string, keepLargestScc?: boolean}} [options]
 * @returns {{graph: Graph, stats: object}}
 */
export function buildGraphFromOsm(osm, { name = 'osm-road-network', keepLargestScc = true } = {}) {
  const nodes = new Map();
  const wayList = [];
  for (const el of osm.elements ?? []) {
    if (el.type === 'node' && Number.isFinite(el.lat) && Number.isFinite(el.lon)) nodes.set(el.id, { lat: el.lat, lng: el.lon });
    else if (el.type === 'way' && el.tags && Array.isArray(el.nodes)) wayList.push(el);
  }

  const skipped = {};
  const usable = [];
  for (const way of wayList) {
    const reason = exclusionReason(way.tags) ?? (way.nodes.filter((n) => nodes.has(n)).length < 2 ? 'missing-nodes' : null);
    if (reason) { skipped[reason] = (skipped[reason] ?? 0) + 1; continue; }
    usable.push({ ...way, nodes: way.nodes.filter((n) => nodes.has(n)) });
  }

  const useCount = new Map();
  for (const way of usable) for (const id of way.nodes) useCount.set(id, (useCount.get(id) ?? 0) + 1);

  // Split ways at intersections into directed segments.
  const edges = [];
  for (const way of usable) {
    const dir = travelDirection(way.tags);
    const kmh = speedKmh(way.tags);
    let start = 0;
    for (let i = 1; i < way.nodes.length; i += 1) {
      const isEnd = i === way.nodes.length - 1;
      if (!isEnd && useCount.get(way.nodes[i]) < 2) continue;
      const ids = way.nodes.slice(start, i + 1);
      start = i;
      const from = ids[0];
      const to = ids[ids.length - 1];
      if (from === to) { skipped['self-loop'] = (skipped['self-loop'] ?? 0) + 1; continue; }
      const points = ids.map((id) => nodes.get(id));
      const distance = lengthOf(points);
      const base = { distance, time: distance / (kmh / 3.6), name: way.tags.name ?? way.tags.ref ?? null, roadType: way.tags.highway, wayId: String(way.id) };
      if (dir !== 'backward') edges.push({ from: String(from), to: String(to), geometry: points, ...base });
      if (dir !== 'forward') edges.push({ from: String(to), to: String(from), geometry: [...points].reverse(), ...base });
    }
  }

  // Optional pruning to the largest strongly connected component.
  const adjacency = new Map();
  for (const e of edges) {
    if (!adjacency.has(e.from)) adjacency.set(e.from, []);
    if (!adjacency.has(e.to)) adjacency.set(e.to, []);
    adjacency.get(e.from).push(e.to);
  }
  const verticesBeforePruning = adjacency.size;
  const keep = keepLargestScc ? new Set(largestComponent(adjacency)) : new Set(adjacency.keys());

  const graph = new Graph({ name });
  const addVertex = (id) => {
    if (graph.hasVertex(id)) return;
    const n = nodes.get(Number(id));
    graph.addVertex(id, { lat: n.lat, lng: n.lng, osmId: id });
  };
  let kept = 0;
  for (const e of edges) {
    if (!keep.has(e.from) || !keep.has(e.to)) continue;
    addVertex(e.from); addVertex(e.to);
    graph.addDirectedEdge(e.from, e.to, e.distance, { time: e.time, name: e.name, roadType: e.roadType, geometry: e.geometry, wayId: e.wayId });
    kept += 1;
  }

  return {
    graph,
    stats: {
      osmNodes: nodes.size,
      osmWays: wayList.length,
      waysUsed: usable.length,
      waysSkipped: skipped,
      directedEdgesBeforePruning: edges.length,
      verticesBeforePruning,
      keptLargestScc: keepLargestScc,
      vertices: graph.vertices.size,
      directedEdges: kept,
    },
  };
}
