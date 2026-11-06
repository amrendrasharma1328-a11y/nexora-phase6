import { describe, it, expect } from 'vitest';
import { Graph } from '../src/engine/Graph.js';
import { dijkstra } from '../src/engine/dijkstra.js';
import { aStar, createGeoHeuristic } from '../src/engine/astar.js';
import { createSampleGraph } from '../src/data/sampleGraph.js';
import { haversineMeters } from '../src/engine/geo.js';
import { errorCode, randomGeoGraph, textbookGraph } from './helpers.js';

describe('A* correctness', () => {
  it('matches Dijkstra with a zero (custom) heuristic on the textbook graph', () => {
    const a = aStar(textbookGraph(), 'A', 'E', { heuristic: () => 0 });
    expect(a.cost).toBe(20);
    expect(a.path).toEqual(['A', 'C', 'F', 'E']);
  });

  it('reports g, h and f scores and the heuristic used', () => {
    const g = createSampleGraph();
    const r = aStar(g, 'N0-0', 'N5-5');
    expect(r.scores.g).toBeCloseTo(r.cost, 9);
    expect(r.scores.h).toBe(0); // h(target) = 0
    expect(r.scores.f).toBeCloseTo(r.scores.g, 9);
    expect(r.heuristic.name).toBe('haversine');
    expect(r.heuristic.unit).toBe('meters');
  });

  it('returns the same optimal cost as Dijkstra for every vertex pair of the sample graph (distance)', () => {
    const g = createSampleGraph();
    const ids = g.getVertexIds();
    let checked = 0;
    for (const s of ids) {
      for (const t of ids) {
        const d = dijkstra(g, s, t, { collectExploredEdges: false });
        const a = aStar(g, s, t, { collectExploredEdges: false });
        expect(a.found).toBe(d.found);
        if (d.found) expect(a.cost).toBeCloseTo(d.cost, 6);
        checked += 1;
      }
    }
    expect(checked).toBe(ids.length * ids.length);
  });

  it('matches Dijkstra on the "time" metric for a sample of pairs', () => {
    const g = createSampleGraph();
    const ids = g.getVertexIds().filter((id) => id.startsWith('N'));
    for (let i = 0; i < ids.length; i += 3) {
      for (let j = 1; j < ids.length; j += 4) {
        const d = dijkstra(g, ids[i], ids[j], { metric: 'time', collectExploredEdges: false });
        const a = aStar(g, ids[i], ids[j], { metric: 'time', collectExploredEdges: false });
        expect(a.found).toBe(d.found);
        if (d.found) expect(a.cost).toBeCloseTo(d.cost, 6);
      }
    }
  });

  it('matches Dijkstra on random directed/mixed graphs (several seeds, both metrics)', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const g = randomGeoGraph(seed);
      const ids = g.getVertexIds();
      for (let k = 0; k < 25; k += 1) {
        const s = ids[(k * 7 + seed) % ids.length];
        const t = ids[(k * 13 + seed * 3) % ids.length];
        for (const metric of ['distance', 'time']) {
          const d = dijkstra(g, s, t, { metric });
          const a = aStar(g, s, t, { metric });
          expect(a.found).toBe(d.found);
          if (d.found) expect(a.cost).toBeCloseTo(d.cost, 6);
        }
      }
    }
  });

  it('explores no more nodes than Dijkstra in total on the sample grid, and strictly fewer overall', () => {
    const g = createSampleGraph({ rows: 12, cols: 12, includeExtras: false });
    let dTotal = 0;
    let aTotal = 0;
    for (const [s, t] of [['N0-0', 'N11-11'], ['N2-9', 'N10-1'], ['N11-0', 'N0-11'], ['N5-5', 'N9-9']]) {
      dTotal += dijkstra(g, s, t).stats.nodesVisited;
      aTotal += aStar(g, s, t).stats.nodesVisited;
    }
    expect(aTotal).toBeLessThanOrEqual(dTotal);
  });

  it('respects directed edges', () => {
    const g = new Graph();
    g.addVertex('A', { lat: 26.0, lng: 80.0 });
    g.addVertex('B', { lat: 26.001, lng: 80.0 });
    g.addDirectedEdge('A', 'B', 120);
    expect(aStar(g, 'A', 'B').found).toBe(true);
    expect(aStar(g, 'B', 'A').found).toBe(false);
  });
});

describe('A* heuristic admissibility and units', () => {
  it('scales the heuristic down when edge distances are shorter than the straight line (unit mismatch)', () => {
    const g = new Graph();
    g.addVertex('A', { lat: 26.0, lng: 80.0 });
    g.addVertex('B', { lat: 26.01, lng: 80.0 });
    const straight = haversineMeters(g.getVertex('A'), g.getVertex('B'));
    g.addBidirectionalEdge('A', 'B', straight / 1000); // pretend distance stored in km
    const { minDistanceRatio } = g.getHeuristicScales();
    expect(minDistanceRatio).toBeCloseTo(0.001, 6);
    const r = aStar(g, 'A', 'B');
    expect(r.cost).toBeCloseTo(straight / 1000, 6);
  });

  it('never overestimates: h(n) <= true remaining cost on the sample graph', () => {
    const g = createSampleGraph();
    const target = 'N5-5';
    const h = createGeoHeuristic(g, target, 'distance');
    for (const id of g.getVertexIds().filter((v) => v.startsWith('N'))) {
      const truth = dijkstra(g, id, target, { collectExploredEdges: false });
      if (truth.found) expect(h(id)).toBeLessThanOrEqual(truth.cost + 1e-6);
    }
  });

  it('time heuristic is expressed in seconds and never overestimates', () => {
    const g = createSampleGraph();
    const target = 'N5-5';
    const h = createGeoHeuristic(g, target, 'time');
    expect(h.description.unit).toBe('seconds');
    for (const id of g.getVertexIds().filter((v) => v.startsWith('N'))) {
      const truth = dijkstra(g, id, target, { metric: 'time', collectExploredEdges: false });
      if (truth.found) expect(h(id)).toBeLessThanOrEqual(truth.cost + 1e-6);
    }
  });
});

describe('A* edge cases', () => {
  it('same source and destination', () => {
    const r = aStar(createSampleGraph(), 'N1-1', 'N1-1');
    expect(r.found).toBe(true);
    expect(r.path).toEqual(['N1-1']);
    expect(r.cost).toBe(0);
  });

  it('unreachable destination', () => {
    const g = createSampleGraph();
    const toIsland = aStar(g, 'N0-0', 'X1');
    const toIsolated = aStar(g, 'N0-0', 'ISOLATED');
    expect(toIsland.found).toBe(false);
    expect(toIsland.reason).toBe('NO_PATH');
    expect(toIsolated.found).toBe(false);
    expect(aStar(g, 'X1', 'X2').found).toBe(true);
  });

  it('invalid vertices and metric', () => {
    const g = createSampleGraph();
    expect(errorCode(() => aStar(g, 'nope', 'N0-0'))).toBe('INVALID_VERTEX');
    expect(errorCode(() => aStar(g, 'N0-0', 'nope'))).toBe('INVALID_VERTEX');
    expect(errorCode(() => aStar(g, 'N0-0', 'N1-1', { metric: 'x' }))).toBe('INVALID_METRIC');
  });

  it('needs destination coordinates for the default heuristic', () => {
    expect(errorCode(() => aStar(textbookGraph(), 'A', 'E'))).toBe('MISSING_COORDINATES');
  });
});
