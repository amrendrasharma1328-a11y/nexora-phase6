import { describe, it, expect } from 'vitest';
import { createLabService, LAB_LIMITS } from '../src/services/labService.js';
import { createLabController } from '../src/controllers/labController.js';

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const lab = createLabService();
const ctl = createLabController({ lab });
const post = (fn, body) => { const res = mockRes(); fn({ body, query: {} }, res); return res; };
const get = (fn, query) => { const res = mockRes(); fn({ query, body: undefined }, res); return res; };

describe('lab service', () => {
  it('describes a graph with vertices, de-duplicated edges and one-way flags', () => {
    const d = lab.describeGraph(8, 8);
    expect(d.vertices).toHaveLength(64);
    expect(d.dataSource.type).toBe('sample');
    expect(d.edges.some((e) => e.oneWay)).toBe(true);
    expect(d.edges.some((e) => !e.oneWay)).toBe(true);
    const keys = d.edges.filter((e) => !e.oneWay).map((e) => [e.from, e.to].sort().join('|'));
    expect(new Set(keys).size).toBe(keys.length); // each two-way road once
  });

  it('runTraced returns real events and metrics that agree with each other', () => {
    const r = lab.runTraced({ rows: 8, cols: 8, algorithm: 'dijkstra', source: 'N0-0', destination: 'N7-7' });
    expect(r.found).toBe(true);
    expect(r.eventCount).toBe(r.events.length);
    expect(r.events.filter((e) => e.type === 'node_visited')).toHaveLength(r.metrics.nodesVisited);
    expect(r.events.filter((e) => e.type === 'edge_explored')).toHaveLength(r.metrics.edgesExplored);
    expect(r.metrics.priorityQueueOperations).toBe(r.metrics.heapInserts + r.metrics.heapExtractions);
    expect(r.metrics.executionTimeMs).toBeGreaterThanOrEqual(0);
    expect(r.timingNote).toContain('hardware');
    expect(r.costUnit).toBe('meters');
  });

  it('compare runs both algorithms on the same pair with equal optimal cost', () => {
    const c = lab.compare({ rows: 12, cols: 12, source: 'N0-0', destination: 'N11-11', metric: 'distance' });
    expect(c.comparison.costsMatch).toBe(true);
    expect(c.runs.astar.metrics.nodesVisited).toBeLessThanOrEqual(c.runs.dijkstra.metrics.nodesVisited);
    expect(c.comparison.nodesSavedByAStar).toBe(c.runs.dijkstra.metrics.nodesVisited - c.runs.astar.metrics.nodesVisited);
    expect(c.comparison.summary.join(' ')).toContain('hardware');
  });

  it('time metric is supported and reported in seconds', () => {
    const r = lab.runTraced({ rows: 6, cols: 6, algorithm: 'astar', metric: 'time', source: 'N0-0', destination: 'N5-5' });
    expect(r.costUnit).toBe('seconds');
    expect(r.heuristic.unit).toBe('seconds');
  });
});

describe('lab controller', () => {
  it('GET graph: defaults, size limits', () => {
    expect(get(ctl.graph, {}).body.vertices).toHaveLength(LAB_LIMITS.defaultSize ** 2);
    expect(get(ctl.graph, { rows: '2' }).statusCode).toBe(400);
    expect(get(ctl.graph, { rows: '26' }).statusCode).toBe(400);
    expect(get(ctl.graph, { rows: 'abc' }).statusCode).toBe(400);
    expect(get(ctl.graph, { rows: '5', cols: '7' }).body.vertices).toHaveLength(35);
  });

  it('POST run: 200 with events', () => {
    const res = post(ctl.run, { rows: 6, cols: 6, algorithm: 'astar', source: 'N0-0', destination: 'N5-5' });
    expect(res.statusCode).toBe(200);
    expect(res.body.events.length).toBeGreaterThan(0);
    expect(res.body.dataSource.type).toBe('sample');
  });

  it('POST run: validation and status codes', () => {
    const base = { rows: 6, cols: 6, algorithm: 'dijkstra', source: 'N0-0', destination: 'N5-5' };
    expect(post(ctl.run, undefined).statusCode).toBe(400);
    expect(post(ctl.run, { ...base, algorithm: 'bfs' }).statusCode).toBe(400);
    expect(post(ctl.run, { ...base, source: undefined }).statusCode).toBe(400);
    expect(post(ctl.run, { ...base, metric: 'fuel' }).statusCode).toBe(400);
    expect(post(ctl.run, { ...base, rows: 100 }).statusCode).toBe(400);
    const unknown = post(ctl.run, { ...base, destination: 'N99-99' });
    expect(unknown.statusCode).toBe(404);
    expect(unknown.body.error.code).toBe('INVALID_VERTEX');
  });

  it('POST compare: needs no algorithm field', () => {
    const res = post(ctl.compare, { rows: 8, cols: 8, source: 'N0-0', destination: 'N7-7' });
    expect(res.statusCode).toBe(200);
    expect(res.body.runs.dijkstra.algorithm).toBe('dijkstra');
    expect(res.body.runs.astar.algorithm).toBe('astar');
  });
});
