import { describe, it, expect } from 'vitest';
import { buildGraphFromOsm } from '../src/osm/buildGraph.js';
import { haversineMeters } from '../src/engine/geo.js';
import { osmFixture } from './fixtures/osmFixture.js';

const build = (opts) => buildGraphFromOsm(osmFixture, opts);
const P = (id) => osmFixture.elements.find((e) => e.type === 'node' && e.id === id);
const pt = (id) => ({ lat: P(id).lat, lng: P(id).lon });

describe('OSM graph construction', () => {
  it('creates vertices only at intersections/endpoints and prunes to the largest strongly connected component', () => {
    const { graph, stats } = build();
    expect(graph.getVertexIds().sort()).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
    expect(stats.verticesBeforePruning).toBe(12);
    expect(stats.vertices).toBe(9);
    expect(stats.directedEdgesBeforePruning).toBe(23);
    expect(stats.directedEdges).toBe(20);
    expect(graph.hasVertex('20')).toBe(false); // curve point is geometry, not an intersection
  });

  it('can keep everything when pruning is disabled', () => {
    const { graph } = build({ keepLargestScc: false });
    expect(graph.getVertexIds().sort()).toEqual(['1', '2', '3', '30', '31', '4', '40', '5', '6', '7', '8', '9']);
  });

  it('skips non-drivable and access-restricted ways and reports why', () => {
    const { stats, graph } = build();
    expect(stats.waysSkipped['not-drivable-class']).toBe(1);   // footway
    expect(stats.waysSkipped['access-access']).toBe(1);        // access=private service road
    expect(graph.getEdge('6', '5')).toBeNull();                // would only exist via the private way
    expect(graph.getEdge('4', '5')).not.toBeNull();            // exists via the drivable one-way, not the footway
  });

  it('respects oneway=yes (forward only)', () => {
    const { graph } = build();
    expect(graph.getEdge('4', '5')).not.toBeNull();
    expect(graph.getEdge('5', '4')).toBeNull();
    expect(graph.getEdge('5', '6')).not.toBeNull();
    expect(graph.getEdge('6', '5')).toBeNull();
  });

  it('respects oneway=-1 (reverse of the way direction)', () => {
    const { graph } = build();
    expect(graph.getEdge('8', '5')).not.toBeNull();
    expect(graph.getEdge('5', '2')).not.toBeNull();
    expect(graph.getEdge('2', '5')).toBeNull();
    expect(graph.getEdge('5', '8')).toBeNull();
  });

  it('keeps two-way roads in both directions with reversed geometry', () => {
    const { graph } = build();
    const fwd = graph.getEdge('1', '4');
    const back = graph.getEdge('4', '1');
    expect(fwd.geometry).toHaveLength(3);
    expect(back.geometry).toEqual([...fwd.geometry].reverse());
    expect(fwd.distance).toBeCloseTo(back.distance, 9);
  });

  it('edge distance comes from road geometry (follows the curve), not the straight line', () => {
    const { graph } = build();
    const e = graph.getEdge('1', '4');
    const viaCurve = haversineMeters(pt(1), pt(20)) + haversineMeters(pt(20), pt(4));
    expect(e.distance).toBeCloseTo(viaCurve, 6);
    expect(e.distance).toBeGreaterThan(haversineMeters(pt(1), pt(4)) + 1);
  });

  it('does not connect roads that cross without sharing a node', () => {
    const { graph } = build({ keepLargestScc: false });
    expect(graph.getNeighbors('30').map((e) => e.to)).toEqual(['31']);
    expect(graph.getNeighbors('31').map((e) => e.to)).toEqual(['30']);
    // nothing in the main grid points at the crossing lane
    for (const id of ['1', '2', '4', '5']) expect(graph.getNeighbors(id).some((e) => e.to === '30' || e.to === '31')).toBe(false);
  });

  it('stores names, road types and way ids', () => {
    const e = build().graph.getEdge('1', '2');
    expect(e.name).toBe('Row Zero');
    expect(e.roadType).toBe('primary');
    expect(e.wayId).toBe('1');
  });

  it('time uses maxspeed when present and an assumed class speed otherwise', () => {
    const { graph } = build();
    const slow = graph.getEdge('7', '8');                      // maxspeed 20 km/h
    expect(slow.time).toBeCloseTo(slow.distance / (20 / 3.6), 6);
    const primary = graph.getEdge('1', '2');                   // assumed primary default 45 km/h
    expect(primary.time).toBeCloseTo(primary.distance / (45 / 3.6), 6);
  });

  it('copes with empty or odd input', () => {
    expect(buildGraphFromOsm({ elements: [] }).graph.vertices.size).toBe(0);
    expect(buildGraphFromOsm({}).graph.vertices.size).toBe(0);
    const missing = { elements: [{ type: 'way', id: 1, nodes: [1, 2], tags: { highway: 'residential' } }] };
    expect(buildGraphFromOsm(missing).stats.waysSkipped['missing-nodes']).toBe(1);
  });
});
