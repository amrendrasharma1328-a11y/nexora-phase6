import { describe, it, expect } from 'vitest';
import { Graph } from '../src/engine/Graph.js';
import { dijkstra } from '../src/engine/dijkstra.js';
import { errorCode, textbookGraph } from './helpers.js';

describe('Dijkstra correctness', () => {
  it('finds the known shortest path in the textbook graph (A -> E = 20 via C, F)', () => {
    const r = dijkstra(textbookGraph(), 'A', 'E');
    expect(r.found).toBe(true);
    expect(r.cost).toBe(20);
    expect(r.path).toEqual(['A', 'C', 'F', 'E']);
  });

  it('returns metrics: visited nodes, explored edges, heap counters and timing', () => {
    const r = dijkstra(textbookGraph(), 'A', 'E');
    expect(r.visitedNodes[0]).toBe('A');
    expect(r.visitedNodes).toContain('E');
    expect(r.stats.nodesVisited).toBe(r.visitedNodes.length);
    expect(r.stats.edgesExplored).toBe(r.exploredEdges.length);
    expect(r.stats.heapInserts).toBeGreaterThan(0);
    expect(r.stats.heapExtractions).toBeGreaterThan(0);
    expect(r.executionTimeMs).toBeGreaterThanOrEqual(0);
    expect(r.stats.pathNodes).toBe(4);
    expect(r.stats.pathEdges).toBe(3);
  });

  it('can skip collecting explored edges but still counts them', () => {
    const r = dijkstra(textbookGraph(), 'A', 'E', { collectExploredEdges: false });
    expect(r.exploredEdges).toHaveLength(0);
    expect(r.stats.edgesExplored).toBeGreaterThan(0);
  });

  it('different edge weights beat fewer hops', () => {
    const g = new Graph();
    ['S', 'M', 'T', 'X', 'Y'].forEach((v) => g.addVertex(v));
    g.addDirectedEdge('S', 'T', 100);          // 1 hop, expensive
    g.addDirectedEdge('S', 'X', 10);
    g.addDirectedEdge('X', 'Y', 10);
    g.addDirectedEdge('Y', 'M', 10);
    g.addDirectedEdge('M', 'T', 10);           // 4 hops, cost 40
    const r = dijkstra(g, 'S', 'T');
    expect(r.cost).toBe(40);
    expect(r.path).toEqual(['S', 'X', 'Y', 'M', 'T']);
  });

  it('metric "time" can choose a different path than metric "distance"', () => {
    const g = textbookGraph();
    const byDistance = dijkstra(g, 'A', 'F', { metric: 'distance' });
    const byTime = dijkstra(g, 'A', 'F', { metric: 'time' });
    expect(byDistance.path).toEqual(['A', 'C', 'F']);
    expect(byDistance.cost).toBe(11);
    expect(byTime.path).toEqual(['A', 'F']);
    expect(byTime.cost).toBe(10);
  });

  it('respects directed edges (no travel against the direction)', () => {
    const g = new Graph();
    ['A', 'B', 'C'].forEach((v) => g.addVertex(v));
    g.addDirectedEdge('A', 'B', 1);
    g.addDirectedEdge('B', 'C', 1);
    expect(dijkstra(g, 'A', 'C').found).toBe(true);
    const back = dijkstra(g, 'C', 'A');
    expect(back.found).toBe(false);
    expect(back.path).toEqual([]);
    expect(back.cost).toBeNull();
  });

  it('one-way road forces a detour', () => {
    const g = new Graph();
    ['A', 'B', 'C'].forEach((v) => g.addVertex(v));
    g.addDirectedEdge('A', 'B', 1);             // one-way A -> B
    g.addBidirectionalEdge('B', 'C', 1);
    g.addBidirectionalEdge('A', 'C', 10);
    const r = dijkstra(g, 'B', 'A');            // cannot use B -> A directly
    expect(r.path).toEqual(['B', 'C', 'A']);
    expect(r.cost).toBe(11);
  });

  it('handles zero-weight edges', () => {
    const g = new Graph();
    ['A', 'B', 'C'].forEach((v) => g.addVertex(v));
    g.addDirectedEdge('A', 'B', 0);
    g.addDirectedEdge('B', 'C', 4);
    expect(dijkstra(g, 'A', 'C').cost).toBe(4);
  });

  it('prefers the cheaper of parallel edges', () => {
    const g = new Graph();
    ['A', 'B'].forEach((v) => g.addVertex(v));
    g.addDirectedEdge('A', 'B', 9);
    g.addDirectedEdge('A', 'B', 3);
    expect(dijkstra(g, 'A', 'B').cost).toBe(3);
  });
});

describe('Dijkstra edge cases', () => {
  it('same source and destination returns a zero-cost single-node path', () => {
    const r = dijkstra(textbookGraph(), 'C', 'C');
    expect(r.found).toBe(true);
    expect(r.path).toEqual(['C']);
    expect(r.cost).toBe(0);
    expect(r.pathEdges).toEqual([]);
  });

  it('unreachable destination returns found=false with reason NO_PATH', () => {
    const g = textbookGraph();
    g.addVertex('Z');
    const r = dijkstra(g, 'A', 'Z');
    expect(r.found).toBe(false);
    expect(r.reason).toBe('NO_PATH');
    expect(r.path).toEqual([]);
    expect(r.cost).toBeNull();
    expect(r.visitedNodes).toHaveLength(6);
  });

  it('throws INVALID_VERTEX for unknown or malformed source/destination', () => {
    const g = textbookGraph();
    expect(errorCode(() => dijkstra(g, 'nope', 'A'))).toBe('INVALID_VERTEX');
    expect(errorCode(() => dijkstra(g, 'A', 'nope'))).toBe('INVALID_VERTEX');
    expect(errorCode(() => dijkstra(g, undefined, 'A'))).toBe('INVALID_VERTEX');
    expect(errorCode(() => dijkstra(g, 'A', ''))).toBe('INVALID_VERTEX');
  });

  it('throws INVALID_METRIC for an unsupported metric', () => {
    expect(errorCode(() => dijkstra(textbookGraph(), 'A', 'B', { metric: 'fuel' }))).toBe('INVALID_METRIC');
  });

  it('throws MISSING_WEIGHT when optimising time on edges without time', () => {
    const g = new Graph();
    ['A', 'B'].forEach((v) => g.addVertex(v));
    g.addDirectedEdge('A', 'B', 5);
    expect(errorCode(() => dijkstra(g, 'A', 'B', { metric: 'time' }))).toBe('MISSING_WEIGHT');
  });

  it('accepts numeric ids interchangeably with string ids', () => {
    const g = new Graph();
    g.addVertex(1); g.addVertex(2);
    g.addDirectedEdge(1, 2, 3);
    expect(dijkstra(g, 1, '2').path).toEqual(['1', '2']);
  });
});
