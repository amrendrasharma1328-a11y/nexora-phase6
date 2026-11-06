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

describe('route controller with coordinates (snapping)', () => {
  it('snaps coordinates to the nearest intersection and reports how far', () => {
    const res = call(controller.shortest, { source: { lat: 26.8501, lng: 80.9501 }, destination: { lat: 26.8599, lng: 80.9611 } });
    expect(res.statusCode).toBe(200);
    expect(res.body.found).toBe(true);
    expect(res.body.path[0]).toBe('N0-0');
    expect(res.body.path[res.body.path.length - 1]).toBe('N5-5');
    expect(res.body.snapped.source.vertexId).toBe('N0-0');
    expect(res.body.snapped.source.distanceMeters).toBeGreaterThan(0);
    expect(res.body.snapped.destination.distanceMeters).toBeLessThan(500);
  });

  it('mixes vertex ids and coordinates', () => {
    const res = call(controller.astar, { source: 'N0-0', destination: { lat: 26.8599, lng: 80.9611 } });
    expect(res.statusCode).toBe(200);
    expect(res.body.snapped.source).toBeNull();
    expect(res.body.snapped.destination.vertexId).toBe('N5-5');
  });

  it('plain id requests carry no "snapped" field', () => {
    expect(call(controller.shortest, { source: 'N0-0', destination: 'N1-1' }).body.snapped).toBeUndefined();
  });

  it('422 NO_NEARBY_ROAD when the point is far from any road', () => {
    const res = call(controller.shortest, { source: { lat: 0, lng: 0 }, destination: 'N1-1' });
    expect(res.statusCode).toBe(422);
    expect(res.body.error.code).toBe('NO_NEARBY_ROAD');
  });

  it('400 for malformed coordinates', () => {
    for (const bad of [{ lat: 200, lng: 0 }, { lat: 'a', lng: 1 }, { lat: 1 }, []]) {
      const res = call(controller.shortest, { source: bad, destination: 'N1-1' });
      expect(res.statusCode).toBe(400);
    }
  });

  it('returns routeGeometry for the map', () => {
    const res = call(controller.shortest, { source: 'N0-0', destination: 'N5-5' });
    expect(res.body.routeGeometry.length).toBeGreaterThan(1);
  });
});
