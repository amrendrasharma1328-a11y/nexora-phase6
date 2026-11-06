import { describe, it, expect } from 'vitest';
import { dijkstra } from '../src/engine/dijkstra.js';
import { aStar } from '../src/engine/astar.js';
import { EVENT_TYPES, makeEmitter } from '../src/engine/events.js';
import { createSampleGraph } from '../src/data/sampleGraph.js';
import { Graph } from '../src/engine/Graph.js';
import { textbookGraph } from './helpers.js';

const trace = (fn, graph, s, t, opts = {}) => {
  const events = [];
  const result = fn(graph, s, t, { ...opts, onEvent: (e) => events.push(e) });
  return { events, result };
};
const count = (events, type) => events.filter((e) => e.type === type).length;
const ofType = (events, type) => events.filter((e) => e.type === type);

for (const [name, fn] of [['Dijkstra', dijkstra], ['A*', aStar]]) {
  describe(`${name} execution events`, () => {
    const g = createSampleGraph();
    const { events, result } = trace(fn, g, 'N0-0', 'N5-5');

    it('emits only known event types, with strictly increasing seq starting at 0', () => {
      expect(events.every((e) => EVENT_TYPES.includes(e.type))).toBe(true);
      events.forEach((e, i) => expect(e.seq).toBe(i));
    });

    it('starts with "start" then the initial queue push of the source', () => {
      expect(events[0].type).toBe('start');
      expect(events[0].source).toBe('N0-0');
      expect(events[1].type).toBe('queue_push');
      expect(events[1].node).toBe('N0-0');
      expect(events[1].reason).toBe('source');
    });

    it('node_visited events match the result\'s visited nodes in order', () => {
      expect(ofType(events, 'node_visited').map((e) => e.node)).toEqual(result.visitedNodes);
    });

    it('event counts equal the reported statistics', () => {
      expect(count(events, 'edge_explored')).toBe(result.stats.edgesExplored);
      expect(count(events, 'queue_push')).toBe(result.stats.heapInserts);
      expect(count(events, 'queue_pop')).toBe(result.stats.heapExtractions);
    });

    it('ends with destination_reached then path_reconstructed carrying the real path and cost', () => {
      const n = events.length;
      expect(events[n - 1].type).toBe('path_reconstructed');
      expect(events[n - 2].type).toBe('destination_reached');
      expect(events[n - 3].type).toBe('node_visited');
      expect(events[n - 3].node).toBe('N5-5');
      expect(ofType(events, 'destination_reached')).toHaveLength(1);
      expect(events[n - 1].path).toEqual(result.path);
      expect(events[n - 1].cost).toBeCloseTo(result.cost, 9);
      expect(events[n - 1].edgeCount).toBe(result.path.length - 1);
    });

    it('distance_updated values only decrease per node and the last one for each path node matches its cost', () => {
      const lastByNode = new Map();
      for (const e of ofType(events, 'distance_updated')) {
        if (lastByNode.has(e.node)) expect(e.newValue).toBeLessThan(lastByNode.get(e.node));
        expect(e.oldValue === null || e.oldValue > e.newValue).toBe(true);
        lastByNode.set(e.node, e.newValue);
      }
      expect(lastByNode.get('N5-5')).toBeCloseTo(result.cost, 9);
    });

    it('every edge_explored starts from a node that was just visited', () => {
      let current = null;
      for (const e of events) {
        if (e.type === 'node_visited') current = e.node;
        if (e.type === 'edge_explored') expect(e.from).toBe(current);
      }
    });

    it('queueSize never goes negative and returns consistent values', () => {
      let size = 0;
      for (const e of events) {
        if (e.type === 'queue_push') size += 1;
        if (e.type === 'queue_pop') size -= 1;
        if (e.type === 'queue_push' || e.type === 'queue_pop') expect(e.queueSize).toBe(size);
      }
    });

    it('does not change results or statistics compared with an untraced run', () => {
      const plain = fn(g, 'N0-0', 'N5-5');
      expect(plain.path).toEqual(result.path);
      expect(plain.cost).toBeCloseTo(result.cost, 9);
      expect(plain.stats.nodesVisited).toBe(result.stats.nodesVisited);
      expect(plain.stats.edgesExplored).toBe(result.stats.edgesExplored);
      expect(plain.stats.heapInserts).toBe(result.stats.heapInserts);
    });

    it('emits no_path (and no destination_reached) for an unreachable target', () => {
      const withIsland = createSampleGraph();
      const t = trace(fn, withIsland, 'N0-0', 'X1');
      expect(t.events[t.events.length - 1].type).toBe('no_path');
      expect(count(t.events, 'destination_reached')).toBe(0);
      expect(count(t.events, 'path_reconstructed')).toBe(0);
    });

    it('same source and destination: visits once and reconstructs a single-node path', () => {
      const t = trace(fn, g, 'N1-1', 'N1-1');
      expect(count(t.events, 'node_visited')).toBe(1);
      expect(t.events[t.events.length - 1].path).toEqual(['N1-1']);
    });
  });
}

describe('A* specific events', () => {
  it('node_visited and distance_updated carry g/h/f consistent with f = g + h', () => {
    const { events } = trace(aStar, createSampleGraph(), 'N0-0', 'N5-5');
    for (const e of ofType(events, 'node_visited')) expect(e.f).toBeCloseTo(e.cost + e.h, 9);
    for (const e of ofType(events, 'distance_updated')) expect(e.f).toBeCloseTo(e.newValue + e.h, 9);
    const last = ofType(events, 'node_visited').pop();
    expect(last.h).toBe(0); // heuristic at the destination
  });

  it('visits fewer or equal nodes than Dijkstra on a grid pair (search behaviour differs)', () => {
    const g = createSampleGraph({ rows: 12, cols: 12, includeExtras: false });
    const d = trace(dijkstra, g, 'N0-0', 'N11-11').result.stats.nodesVisited;
    const a = trace(aStar, g, 'N0-0', 'N11-11').result.stats.nodesVisited;
    expect(a).toBeLessThanOrEqual(d);
  });
});

describe('event helpers', () => {
  it('makeEmitter returns null without a callback and numbers events otherwise', () => {
    expect(makeEmitter(undefined)).toBeNull();
    expect(makeEmitter('x')).toBeNull();
    const out = [];
    const emit = makeEmitter((e) => out.push(e));
    emit({ type: 'a' }); emit({ type: 'b' });
    expect(out).toEqual([{ seq: 0, type: 'a' }, { seq: 1, type: 'b' }]);
  });

  it('a throwing listener does not corrupt results of an untraced run on the same graph', () => {
    const g = textbookGraph();
    let threw = false;
    try { dijkstra(g, 'A', 'E', { onEvent: () => { throw new Error('listener failed'); } }); } catch { threw = true; }
    expect(threw).toBe(true);
    expect(dijkstra(g, 'A', 'E').cost).toBe(20);
  });

  it('re-expansion is reported when a custom inconsistent heuristic forces it', () => {
    // A -> B (1), A -> C (1), C -> B (1), B -> T (1); h(B) is large (admissible overall is not required for reopening to be visible)
    const g = new Graph();
    ['A', 'B', 'C', 'T'].forEach((v) => g.addVertex(v));
    g.addDirectedEdge('A', 'B', 4); g.addDirectedEdge('A', 'C', 1); g.addDirectedEdge('C', 'B', 1); g.addDirectedEdge('B', 'T', 1);
    const h = { A: 0, B: 0, C: 3, T: 0 };
    const { events, result } = trace(aStar, g, 'A', 'T', { heuristic: (id) => h[id] });
    expect(result.cost).toBe(3);
    expect(ofType(events, 'node_visited').some((e) => e.reExpansion === true)).toBe(true);
  });
});
