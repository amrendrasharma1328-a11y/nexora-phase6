import { describe, it, expect } from 'vitest';
import { createRouteController } from '../src/controllers/routeController.js';
import { createSampleGraph, SAMPLE_DATA_SOURCE } from '../src/data/sampleGraph.js';

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const controller = createRouteController({ graph: createSampleGraph(), dataSource: SAMPLE_DATA_SOURCE });
const call = (handler, body) => { const res = mockRes(); handler({ body }, res); return res; };

describe('route controller (validation and status codes)', () => {
  it('health returns 200 ok', () => {
    const res = mockRes();
    controller.health({}, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('statistics returns graph stats and the data source label', () => {
    const res = mockRes();
    controller.statistics({}, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.graph.vertexCount).toBe(39);
    expect(res.body.dataSource.type).toBe('sample');
  });

  it('shortest: 200 with a computed distance route', () => {
    const res = call(controller.shortest, { source: 'N0-0', destination: 'N5-5' });
    expect(res.statusCode).toBe(200);
    expect(res.body.found).toBe(true);
    expect(res.body.algorithm).toBe('dijkstra');
    expect(res.body.metric).toBe('distance');
    expect(res.body.cost.unit).toBe('meters');
    expect(res.body.coordinates.length).toBe(res.body.path.length);
    expect(res.body.dataSource.type).toBe('sample');
    expect(res.body.visitedNodes).toBeUndefined();
  });

  it('fastest: 200 with metric time in seconds', () => {
    const res = call(controller.fastest, { source: 'N0-0', destination: 'N5-5' });
    expect(res.statusCode).toBe(200);
    expect(res.body.metric).toBe('time');
    expect(res.body.cost.unit).toBe('seconds');
    expect(res.body.estimatedTimeSeconds).toBeCloseTo(res.body.cost.value, 6);
  });

  it('astar: honours metric and includeDetails', () => {
    const res = call(controller.astar, { source: 'N0-0', destination: 'N5-5', metric: 'time', includeDetails: true });
    expect(res.statusCode).toBe(200);
    expect(res.body.algorithm).toBe('astar');
    expect(res.body.metric).toBe('time');
    expect(res.body.heuristic.unit).toBe('seconds');
    expect(res.body.visitedNodes.length).toBeGreaterThan(0);
    expect(res.body.exploredEdges.length).toBeGreaterThan(0);
  });

  it('astar and shortest agree on distance', () => {
    const a = call(controller.astar, { source: 'N0-0', destination: 'N4-5' });
    const d = call(controller.shortest, { source: 'N0-0', destination: 'N4-5' });
    expect(a.body.cost.value).toBeCloseTo(d.body.cost.value, 6);
  });

  it('same source and destination: 200, zero cost', () => {
    const res = call(controller.shortest, { source: 'N1-1', destination: 'N1-1' });
    expect(res.statusCode).toBe(200);
    expect(res.body.cost.value).toBe(0);
    expect(res.body.path).toEqual(['N1-1']);
  });

  it('unreachable destination: 200 with found=false and reason NO_PATH', () => {
    const res = call(controller.shortest, { source: 'N0-0', destination: 'ISOLATED' });
    expect(res.statusCode).toBe(200);
    expect(res.body.found).toBe(false);
    expect(res.body.reason).toBe('NO_PATH');
    expect(res.body.cost).toBeNull();
  });

  it('unknown vertex: 404 INVALID_VERTEX', () => {
    const res = call(controller.shortest, { source: 'N0-0', destination: 'nowhere' });
    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe('INVALID_VERTEX');
  });

  it('bad bodies: 400 INVALID_REQUEST', () => {
    for (const body of [undefined, null, 'x', [], {}, { source: 'N0-0' }, { destination: 'N0-0' }, { source: '', destination: 'N0-0' }, { source: 'N0-0', destination: 'N1-1', includeDetails: 'yes' }]) {
      const res = call(controller.shortest, body);
      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
    }
  });

  it('astar rejects an unsupported metric with 400', () => {
    const res = call(controller.astar, { source: 'N0-0', destination: 'N1-1', metric: 'fuel' });
    expect(res.statusCode).toBe(400);
  });

  it('shortest ignores a client-supplied metric (route type is fixed by the endpoint)', () => {
    const res = call(controller.shortest, { source: 'N0-0', destination: 'N3-3', metric: 'time' });
    expect(res.body.metric).toBe('distance');
  });
});
