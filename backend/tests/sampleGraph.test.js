import { describe, it, expect } from 'vitest';
import { createSampleGraph } from '../src/data/sampleGraph.js';
import { dijkstra } from '../src/engine/dijkstra.js';

describe('sample graph (synthetic, not real roads)', () => {
  it('contains one-way edges, a closed block, and unreachable vertices', () => {
    const g = createSampleGraph();
    const s = g.statistics();
    expect(s.vertexCount).toBe(39);
    expect(s.oneWayEdgeCount).toBeGreaterThan(0);
    expect(s.isolatedVertexCount).toBe(1);
    expect(g.getEdge('N2-2', 'N2-3')).toBeNull(); // closed block
  });

  it('one-way column 1 is southbound only', () => {
    const g = createSampleGraph();
    expect(g.getEdge('N0-1', 'N1-1')).not.toBeNull();
    expect(g.getEdge('N1-1', 'N0-1')).toBeNull();
  });

  it('edge distances are never shorter than the straight line (distance ratio >= ~1)', () => {
    expect(createSampleGraph().getHeuristicScales().minDistanceRatio).toBeCloseTo(1, 6);
  });

  it('shortest and fastest routes are computed, not hardcoded (they can differ)', () => {
    const g = createSampleGraph();
    const shortest = dijkstra(g, 'N0-0', 'N5-5', { metric: 'distance' });
    const fastest = dijkstra(g, 'N0-0', 'N5-5', { metric: 'time' });
    expect(shortest.found).toBe(true);
    expect(fastest.found).toBe(true);
    const timeOf = (r) => r.pathEdges.reduce((t, e) => t + e.time, 0);
    expect(timeOf(fastest)).toBeLessThanOrEqual(timeOf(shortest) + 1e-9);
  });
});
