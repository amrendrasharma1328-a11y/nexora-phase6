import { describe, it, expect } from 'vitest';
import { Graph } from '../src/engine/Graph.js';
import { errorCode } from './helpers.js';

describe('Graph creation and vertices', () => {
  it('creates an empty graph', () => {
    const g = new Graph({ name: 'x' });
    expect(g.statistics().vertexCount).toBe(0);
    expect(g.statistics().edgeCount).toBe(0);
    expect(g.statistics().averageOutDegree).toBe(0);
  });

  it('adds and looks up vertices (ids normalised to strings)', () => {
    const g = new Graph();
    g.addVertex(1, { lat: 26.8, lng: 80.9 });
    g.addVertex('B');
    expect(g.hasVertex('1')).toBe(true);
    expect(g.hasVertex(1)).toBe(true);
    expect(g.getVertex(1).lat).toBe(26.8);
    expect(g.getVertex('nope')).toBeNull();
    expect(g.getVertexIds()).toEqual(['1', 'B']);
  });

  it('rejects duplicate vertices, bad ids and bad coordinates', () => {
    const g = new Graph();
    g.addVertex('A');
    expect(errorCode(() => g.addVertex('A'))).toBe('DUPLICATE_VERTEX');
    expect(errorCode(() => g.addVertex(''))).toBe('INVALID_VERTEX_ID');
    expect(errorCode(() => g.addVertex(null))).toBe('INVALID_VERTEX_ID');
    expect(errorCode(() => g.addVertex('C', { lat: 200, lng: 0 }))).toBe('INVALID_COORDINATES');
    expect(errorCode(() => g.addVertex('D', { lat: 10 }))).toBe('INVALID_COORDINATES');
  });
});

describe('Graph edges', () => {
  const make = () => { const g = new Graph(); ['A', 'B', 'C'].forEach((v) => g.addVertex(v)); return g; };

  it('directed edges only go one way', () => {
    const g = make();
    g.addDirectedEdge('A', 'B', 5);
    expect(g.getNeighbors('A')).toHaveLength(1);
    expect(g.getNeighbors('B')).toHaveLength(0);
    expect(g.getEdge('A', 'B').distance).toBe(5);
    expect(g.getEdge('B', 'A')).toBeNull();
  });

  it('bidirectional edges create both directions', () => {
    const g = make();
    g.addBidirectionalEdge('A', 'B', 5, { time: 10 });
    expect(g.getEdge('A', 'B').time).toBe(10);
    expect(g.getEdge('B', 'A').time).toBe(10);
    expect(g.edgeCount).toBe(2);
  });

  it('addEdge respects the bidirectional option', () => {
    const g = make();
    g.addEdge('A', 'B', 1, { bidirectional: true });
    g.addEdge('B', 'C', 1);
    expect(g.edgeCount).toBe(3);
  });

  it('stores weights, names and road types; getWeight picks the metric', () => {
    const g = make();
    g.addDirectedEdge('A', 'B', 100, { time: 12, name: 'Main St', roadType: 'main' });
    const e = g.getEdge('A', 'B');
    expect(g.getWeight(e, 'distance')).toBe(100);
    expect(g.getWeight(e, 'time')).toBe(12);
    expect(e.name).toBe('Main St');
    expect(e.roadType).toBe('main');
    g.addDirectedEdge('B', 'C', 50);
    expect(g.getWeight(g.getEdge('B', 'C'), 'time')).toBeNull();
  });

  it('rejects unknown vertices and invalid weights', () => {
    const g = make();
    expect(errorCode(() => g.addDirectedEdge('A', 'Z', 1))).toBe('UNKNOWN_VERTEX');
    expect(errorCode(() => g.addDirectedEdge('Z', 'A', 1))).toBe('UNKNOWN_VERTEX');
    expect(errorCode(() => g.addDirectedEdge('A', 'B', -1))).toBe('INVALID_WEIGHT');
    expect(errorCode(() => g.addDirectedEdge('A', 'B', NaN))).toBe('INVALID_WEIGHT');
    expect(errorCode(() => g.addDirectedEdge('A', 'B', Infinity))).toBe('INVALID_WEIGHT');
    expect(errorCode(() => g.addDirectedEdge('A', 'B', 1, { time: -5 }))).toBe('INVALID_WEIGHT');
    expect(errorCode(() => g.getNeighbors('Z'))).toBe('UNKNOWN_VERTEX');
  });

  it('computes statistics including one-way edges and isolated vertices', () => {
    const g = make();
    g.addVertex('D');
    g.addBidirectionalEdge('A', 'B', 10, { time: 1 });
    g.addDirectedEdge('B', 'C', 20);
    const s = g.statistics();
    expect(s.vertexCount).toBe(4);
    expect(s.edgeCount).toBe(3);
    expect(s.oneWayEdgeCount).toBe(1);
    expect(s.isolatedVertexCount).toBe(1);
    expect(s.edgesWithTime).toBe(2);
    expect(s.totalEdgeDistanceMeters).toBe(40);
    expect(s.averageOutDegree).toBeCloseTo(0.75, 10);
  });

  it('statistics include the bounding box of vertices with coordinates', () => {
    const g = new Graph();
    g.addVertex('A', { lat: 1, lng: 2 });
    g.addVertex('B', { lat: 3, lng: 1 });
    expect(g.statistics().boundingBox).toEqual({ minLat: 1, maxLat: 3, minLng: 1, maxLng: 2 });
  });
});
