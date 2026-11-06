import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp({ geocoder: { search: async () => [] } });

describe('HTTP API', () => {
  it('GET /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('nexora-backend');
  });

  it('GET /api/graph/statistics', async () => {
    const res = await request(app).get('/api/graph/statistics');
    expect(res.status).toBe(200);
    expect(res.body.graph.vertexCount).toBeGreaterThan(0);
    expect(res.body.dataSource.type).toBe('sample');
  });

  it('POST /api/routes/shortest', async () => {
    const res = await request(app).post('/api/routes/shortest').send({ source: 'N0-0', destination: 'N5-5' });
    expect(res.status).toBe(200);
    expect(res.body.found).toBe(true);
    expect(res.body.path[0]).toBe('N0-0');
  });

  it('POST /api/routes/fastest', async () => {
    const res = await request(app).post('/api/routes/fastest').send({ source: 'N0-0', destination: 'N5-5' });
    expect(res.status).toBe(200);
    expect(res.body.metric).toBe('time');
  });

  it('POST /api/routes/astar', async () => {
    const res = await request(app).post('/api/routes/astar').send({ source: 'N0-0', destination: 'N5-5' });
    expect(res.status).toBe(200);
    expect(res.body.algorithm).toBe('astar');
  });

  it('400 for a missing field, 404 for an unknown vertex, 400 for malformed JSON', async () => {
    expect((await request(app).post('/api/routes/shortest').send({ source: 'N0-0' })).status).toBe(400);
    expect((await request(app).post('/api/routes/shortest').send({ source: 'N0-0', destination: 'zzz' })).status).toBe(404);
    const bad = await request(app).post('/api/routes/shortest').set('Content-Type', 'application/json').send('{bad');
    expect(bad.status).toBe(400);
  });

  it('404 JSON for unknown API routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('HTTP API: search and coordinates', () => {
  const fakeGeocoder = { search: async (q) => { if (q === 'boom') { const { GeocodingError } = await import('../src/osm/geocoder.js'); throw new GeocodingError('GEOCODER_UNAVAILABLE', 'down', 502); } return [{ displayName: `Result for ${q}`, lat: 26.85, lng: 80.95 }]; } };
  const app2 = createApp({ geocoder: fakeGeocoder });

  it('GET /api/search returns results with attribution', async () => {
    const res = await request(app2).get('/api/search').query({ q: 'Hazratganj' });
    expect(res.status).toBe(200);
    expect(res.body.results[0].displayName).toContain('Hazratganj');
    expect(res.body.attribution).toContain('OpenStreetMap');
  });

  it('GET /api/search maps upstream failure to 502', async () => {
    expect((await request(app2).get('/api/search').query({ q: 'boom' })).status).toBe(502);
  });

  it('POST /api/routes/shortest accepts coordinates', async () => {
    const res = await request(app2).post('/api/routes/shortest').send({ source: { lat: 26.8501, lng: 80.9501 }, destination: { lat: 26.8599, lng: 80.9611 } });
    expect(res.status).toBe(200);
    expect(res.body.snapped.source.vertexId).toBe('N0-0');
  });
});

describe('HTTP API: algorithm lab', () => {
  it('GET /api/lab/graph', async () => {
    const res = await request(app).get('/api/lab/graph').query({ rows: 6, cols: 6 });
    expect(res.status).toBe(200);
    expect(res.body.vertices).toHaveLength(36);
  });

  it('POST /api/lab/run and /api/lab/compare', async () => {
    const run = await request(app).post('/api/lab/run').send({ rows: 6, cols: 6, algorithm: 'dijkstra', source: 'N0-0', destination: 'N5-5' });
    expect(run.status).toBe(200);
    expect(run.body.events.length).toBeGreaterThan(0);
    const cmp = await request(app).post('/api/lab/compare').send({ rows: 6, cols: 6, source: 'N0-0', destination: 'N5-5' });
    expect(cmp.status).toBe(200);
    expect(cmp.body.comparison.costsMatch).toBe(true);
  });

  it('400 on bad lab request', async () => {
    expect((await request(app).get('/api/lab/graph').query({ rows: 1 })).status).toBe(400);
  });
});
