import { describe, it, expect } from 'vitest';
import { buildGraphFromOsm } from '../src/osm/buildGraph.js';
import { dijkstra } from '../src/engine/dijkstra.js';
import { aStar } from '../src/engine/astar.js';
import { computeRoute } from '../src/services/routingService.js';
import { createSampleGraph } from '../src/data/sampleGraph.js';
import { osmFixture } from './fixtures/osmFixture.js';

const { graph } = buildGraphFromOsm(osmFixture);
const full = buildGraphFromOsm(osmFixture, { keepLargestScc: false }).graph;

describe('routing over an OSM-built graph', () => {
  it('uses a one-way road in its allowed direction', () => {
    expect(dijkstra(graph, '4', '6').path).toEqual(['4', '5', '6']);
    expect(dijkstra(graph, '8', '2').path).toEqual(['8', '5', '2']);
  });

  it('detours when the one-way direction is against you', () => {
    const r = dijkstra(graph, '6', '4');
    expect(r.found).toBe(true);
    const hops = r.path.map((_, i) => `${r.path[i]}>${r.path[i + 1]}`);
    expect(hops).not.toContain('6>5');
    expect(r.path.length).toBeGreaterThan(3);
    const back = dijkstra(graph, '2', '8');
    expect(back.path.join('>')).not.toContain('2>5');
  });

  it('route cost equals the sum of edge lengths (itself the sum over road geometry)', () => {
    const r = dijkstra(graph, '6', '4');
    expect(r.cost).toBeCloseTo(r.pathEdges.reduce((s, e) => s + e.distance, 0), 6);
  });

  it('handles unreachable destinations: dead-end spur and disconnected roads', () => {
    expect(dijkstra(full, '9', '40').found).toBe(true);     // can enter the spur
    expect(dijkstra(full, '40', '9').found).toBe(false);    // cannot leave it
    expect(dijkstra(full, '1', '30').found).toBe(false);    // crossing road is not connected
    expect(dijkstra(full, '30', '1').found).toBe(false);
  });

  it('A* matches Dijkstra for every pair, both metrics', () => {
    const ids = graph.getVertexIds();
    for (const s of ids) for (const t of ids) for (const metric of ['distance', 'time']) {
      const d = dijkstra(graph, s, t, { metric });
      const a = aStar(graph, s, t, { metric });
      expect(a.found).toBe(d.found);
      expect(a.cost).toBeCloseTo(d.cost, 6);
    }
  });

  it('heuristic scale stays admissible on OSM geometry (distance ratio >= 1 => capped at 1)', () => {
    expect(graph.getHeuristicScales().minDistanceRatio).toBeCloseTo(1, 6);
  });

  it('returns road geometry for the map, following curve points', () => {
    const r = computeRoute(graph, { algorithm: 'dijkstra', metric: 'distance', source: '1', destination: '4' });
    expect(r.routeGeometry).toHaveLength(3);
    expect(r.routeGeometry[0]).toEqual([26.85, 80.95]);
    expect(r.routeGeometry[1]).toEqual([26.8525, 80.9515]);
    expect(r.routeGeometry[2]).toEqual([26.855, 80.95]);
    expect(r.distanceMeters).toBeCloseTo(r.cost.value, 6);
  });

  it('route geometry is continuous (no duplicated joints) across multiple edges', () => {
    const r = computeRoute(graph, { algorithm: 'astar', metric: 'distance', source: '1', destination: '9' });
    for (let i = 1; i < r.routeGeometry.length; i += 1) {
      expect(r.routeGeometry[i][0] === r.routeGeometry[i - 1][0] && r.routeGeometry[i][1] === r.routeGeometry[i - 1][1]).toBe(false);
    }
    expect(r.routeGeometry[0]).toEqual([26.85, 80.95]);
    expect(r.routeGeometry[r.routeGeometry.length - 1]).toEqual([26.86, 80.96]);
  });

  it('falls back to vertex coordinates when edges have no geometry (sample graph)', () => {
    const r = computeRoute(createSampleGraph(), { algorithm: 'dijkstra', metric: 'distance', source: 'N0-0', destination: 'N5-5' });
    expect(r.routeGeometry).toHaveLength(r.path.length);
  });
});
