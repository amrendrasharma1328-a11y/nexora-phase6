import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { createWorkspaceStore } from '../src/store/workspaceStore.js';

const geocoder = { search: async () => [] };
const H = 'X-Nexora-Workspace';
const place = (label, lat, lng) => ({ label, lat, lng });
const savedBody = (over = {}) => ({
  name: 'Home to office',
  source: place('Home', 26.8501, 80.9501), destination: place('Office', 26.8599, 80.9611),
  algorithm: 'dijkstra', metric: 'distance', distanceMeters: 1954, estimatedTimeSeconds: 138, dataSource: 'sample', ...over,
});

let app;
const control = async (label) => (await request(app).post('/api/session').send(label ? { label } : {})).body;
beforeEach(() => { app = createApp({ geocoder }); });

describe('control sessions (anonymous workspaces, not authentication)', () => {
  it('POST /api/session creates a session and GET validates it', async () => {
    const res = await request(app).post('/api/session').send({ label: 'Amrendra' });
    expect(res.status).toBe(201);
    expect(res.body.workspaceId).toMatch(/^ws_[0-9a-f]{32}$/);
    expect(res.body.label).toBe('Amrendra');
    const check = await request(app).get('/api/session').set(H, res.body.workspaceId);
    expect(check.status).toBe(200);
    expect(check.body.counts).toEqual({ savedRoutes: 0, history: 0 });
  });

  it('validates the label', async () => {
    expect((await request(app).post('/api/session').send({ label: 'x'.repeat(41) })).status).toBe(400);
    expect((await request(app).post('/api/session').send({ label: '<script>' })).status).toBe(400);
    expect((await request(app).post('/api/session').send({ label: 42 })).status).toBe(400);
    expect((await request(app).post('/api/session').send({})).status).toBe(201);
  });

  it('401 CONTROL_REQUIRED without a header and CONTROL_INVALID for unknown/malformed ids', async () => {
    const none = await request(app).get('/api/saved-routes');
    expect(none.status).toBe(401);
    expect(none.body.error.code).toBe('CONTROL_REQUIRED');
    for (const bad of ['ws_' + '0'.repeat(32), 'nope', '../x']) {
      const r = await request(app).get('/api/saved-routes').set(H, bad);
      expect(r.status).toBe(401);
      expect(r.body.error.code).toBe('CONTROL_INVALID');
    }
  });

  it('DELETE /api/session erases the workspace and its data', async () => {
    const { workspaceId } = await control();
    await request(app).post('/api/saved-routes').set(H, workspaceId).send(savedBody());
    expect((await request(app).delete('/api/session').set(H, workspaceId)).status).toBe(200);
    expect((await request(app).get('/api/saved-routes').set(H, workspaceId)).status).toBe(401);
  });

  it('rate limits session creation', async () => {
    const limited = createApp({ geocoder, controlRateLimit: { limit: 2, windowMs: 60_000 } });
    expect((await request(limited).post('/api/session').send({})).status).toBe(201);
    expect((await request(limited).post('/api/session').send({})).status).toBe(201);
    const third = await request(limited).post('/api/session').send({});
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe('RATE_LIMITED');
    expect(third.headers['retry-after']).toBeDefined();
  });
});

describe('saved routes', () => {
  it('saves, lists (newest first), reads and deletes a route', async () => {
    const { workspaceId: id } = await control();
    const first = await request(app).post('/api/saved-routes').set(H, id).send(savedBody());
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ name: 'Home to office', distanceMeters: 1954, estimatedTimeSeconds: 138 });
    expect(first.body.id).toMatch(/^sr_/);
    await request(app).post('/api/saved-routes').set(H, id).send(savedBody({ name: 'Second', algorithm: 'astar' }));

    const list = await request(app).get('/api/saved-routes').set(H, id);
    expect(list.body.total).toBe(2);
    expect(list.body.items.map((r) => r.name)).toEqual(['Second', 'Home to office']);

    expect((await request(app).get(`/api/saved-routes/${first.body.id}`).set(H, id)).body.name).toBe('Home to office');
    expect((await request(app).delete(`/api/saved-routes/${first.body.id}`).set(H, id)).status).toBe(200);
    expect((await request(app).get(`/api/saved-routes/${first.body.id}`).set(H, id)).status).toBe(404);
    expect((await request(app).delete(`/api/saved-routes/${first.body.id}`).set(H, id)).status).toBe(404);
    expect((await request(app).get('/api/saved-routes').set(H, id)).body.total).toBe(1);
  });

  it('rejects duplicates with 409 and points at the existing route', async () => {
    const { workspaceId: id } = await control();
    const a = await request(app).post('/api/saved-routes').set(H, id).send(savedBody());
    const dup = await request(app).post('/api/saved-routes').set(H, id).send(savedBody({ name: 'Another name' }));
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('DUPLICATE_ROUTE');
    expect(dup.body.error.details.existingId).toBe(a.body.id);
    // same places with a different algorithm is a different saved route
    expect((await request(app).post('/api/saved-routes').set(H, id).send(savedBody({ name: 'A*', algorithm: 'astar' }))).status).toBe(201);
  });

  it('validates every field', async () => {
    const { workspaceId: id } = await control();
    const bad = [
      { name: '' }, { name: '   ' }, { name: 'x'.repeat(81) }, { name: 'ok\u0007' }, { name: 7 },
      { source: { label: 'A', lat: 120, lng: 0 } }, { destination: { label: '', lat: 1, lng: 1 } }, { source: 'N0-0' },
      { algorithm: 'bfs' }, { metric: 'cheapest' }, { distanceMeters: -1 }, { distanceMeters: 'far' }, { estimatedTimeSeconds: -5 }, { dataSource: 'google' },
    ];
    for (const over of bad) {
      const r = await request(app).post('/api/saved-routes').set(H, id).send(savedBody(over));
      expect(r.status, JSON.stringify(over)).toBe(400);
      expect(r.body.error.code).toBe('INVALID_REQUEST');
    }
    expect((await request(app).post('/api/saved-routes').set(H, id).send([])).status).toBe(400);
    expect((await request(app).get('/api/saved-routes').set(H, id)).body.total).toBe(0);
  });

  it('normalises the name (trim, collapse spaces) and allows null estimated time', async () => {
    const { workspaceId: id } = await control();
    const r = await request(app).post('/api/saved-routes').set(H, id).send(savedBody({ name: '  Home   to  office ', estimatedTimeSeconds: null }));
    expect(r.status).toBe(201);
    expect(r.body.name).toBe('Home to office');
    expect(r.body.estimatedTimeSeconds).toBeNull();
  });

  it('keeps workspaces isolated from each other', async () => {
    const a = (await control()).workspaceId;
    const b = (await control()).workspaceId;
    const saved = await request(app).post('/api/saved-routes').set(H, a).send(savedBody());
    expect((await request(app).get('/api/saved-routes').set(H, b)).body.total).toBe(0);
    expect((await request(app).get(`/api/saved-routes/${saved.body.id}`).set(H, b)).status).toBe(404);
    expect((await request(app).delete(`/api/saved-routes/${saved.body.id}`).set(H, b)).status).toBe(404);
    expect((await request(app).get('/api/saved-routes').set(H, a)).body.total).toBe(1);
  });

  it('enforces the per-workspace limit', async () => {
    const { workspaceId: id } = await control();
    for (let i = 0; i < 200; i += 1) {
      const r = await request(app).post('/api/saved-routes').set(H, id).send(savedBody({ name: `r${i}`, source: place('S', 26.1 + i * 0.0001, 80.1) }));
      expect(r.status).toBe(201);
    }
    const over = await request(app).post('/api/saved-routes').set(H, id).send(savedBody({ name: 'one too many', source: place('S', 27, 81) }));
    expect(over.status).toBe(422);
    expect(over.body.error.code).toBe('LIMIT_REACHED');
  }, 30_000);
});

describe('route history (recorded by the routing endpoints)', () => {
  const route = (id, body, path = '/api/routes/shortest') => request(app).post(path).set(H, id).send(body);
  const coords = { source: { lat: 26.8501, lng: 80.9501 }, destination: { lat: 26.8599, lng: 80.9611 } };

  it('records a calculation with places, algorithm, distance, time, execution time and timestamp', async () => {
    const { workspaceId: id } = await control();
    const res = await route(id, { ...coords, labels: { source: 'Home', destination: 'Office' } });
    expect(res.status).toBe(200);
    const h = (await request(app).get('/api/history').set(H, id)).body;
    expect(h.total).toBe(1);
    expect(h.items[0]).toMatchObject({
      source: { label: 'Home', lat: 26.8501, lng: 80.9501 },
      destination: { label: 'Office', lat: 26.8599, lng: 80.9611 },
      algorithm: 'dijkstra', metric: 'distance', found: true, dataSource: 'sample',
      distanceMeters: res.body.distanceMeters, estimatedTimeSeconds: res.body.estimatedTimeSeconds,
      executionTimeMs: res.body.executionTimeMs, nodesVisited: res.body.stats.nodesVisited,
    });
    expect(new Date(h.items[0].at).toString()).not.toBe('Invalid Date');
  });

  it('records the right algorithm/metric for fastest and A*', async () => {
    const { workspaceId: id } = await control();
    await route(id, coords, '/api/routes/fastest');
    await route(id, { ...coords, metric: 'time' }, '/api/routes/astar');
    const items = (await request(app).get('/api/history').set(H, id)).body.items;
    expect(items.map((i) => [i.algorithm, i.metric])).toEqual([['astar', 'time'], ['dijkstra', 'time']]); // newest first
  });

  it('falls back to readable labels and vertex coordinates when no labels are sent', async () => {
    const { workspaceId: id } = await control();
    await route(id, { source: 'N0-0', destination: 'N5-5' });
    const item = (await request(app).get('/api/history').set(H, id)).body.items[0];
    expect(item.source.label).toBe('Vertex N0-0');
    expect(Number.isFinite(item.source.lat)).toBe(true);
  });

  it('records no-path results with found=false', async () => {
    const { workspaceId: id } = await control();
    const res = await route(id, { source: 'N0-0', destination: 'ISOLATED' });
    expect(res.body.found).toBe(false);
    const item = (await request(app).get('/api/history').set(H, id)).body.items[0];
    expect(item).toMatchObject({ found: false, distanceMeters: null });
  });

  it('does not record without a session, with an unknown session, or for failed requests, and never breaks routing', async () => {
    const { workspaceId: id } = await control();
    expect((await request(app).post('/api/routes/shortest').send(coords)).status).toBe(200);
    expect((await request(app).post('/api/routes/shortest').set(H, 'ws_' + 'f'.repeat(32)).send(coords)).status).toBe(200);
    expect((await route(id, { source: 'N0-0', destination: 'nope' })).status).toBe(404);
    expect((await route(id, { source: 'N0-0' })).status).toBe(400);
    expect((await request(app).get('/api/history').set(H, id)).body.total).toBe(0);
  });

  it('rejects invalid labels without calculating', async () => {
    const { workspaceId: id } = await control();
    expect((await route(id, { ...coords, labels: { source: 'x'.repeat(201) } })).status).toBe(400);
    expect((await route(id, { ...coords, labels: 'Home' })).status).toBe(400);
  });

  it('does not record Algorithm Lab runs (synthetic data)', async () => {
    const { workspaceId: id } = await control();
    await request(app).post('/api/lab/run').set(H, id).send({ rows: 6, cols: 6, algorithm: 'dijkstra', source: 'N0-0', destination: 'N5-5' });
    expect((await request(app).get('/api/history').set(H, id)).body.total).toBe(0);
  });

  it('paginates (newest first), filters by algorithm and validates query values', async () => {
    const { workspaceId: id } = await control();
    for (let i = 0; i < 5; i += 1) await route(id, { ...coords, labels: { destination: `D${i}` } });
    await route(id, coords, '/api/routes/astar');
    const page1 = (await request(app).get('/api/history').query({ limit: 4 }).set(H, id)).body;
    expect(page1.items).toHaveLength(4);
    expect(page1.total).toBe(6);
    expect(page1.items[0].algorithm).toBe('astar');
    const page2 = (await request(app).get('/api/history').query({ limit: 4, offset: 4 }).set(H, id)).body;
    expect(page2.items).toHaveLength(2);
    const astarOnly = (await request(app).get('/api/history').query({ algorithm: 'astar' }).set(H, id)).body;
    expect(astarOnly.total).toBe(1);
    for (const q of [{ limit: 0 }, { limit: 101 }, { offset: -1 }, { limit: 'x' }, { algorithm: 'bfs' }]) {
      expect((await request(app).get('/api/history').query(q).set(H, id)).status, JSON.stringify(q)).toBe(400);
    }
  });

  it('DELETE /api/history clears the history but keeps saved routes', async () => {
    const { workspaceId: id } = await control();
    await route(id, coords); await route(id, coords);
    await request(app).post('/api/saved-routes').set(H, id).send(savedBody());
    const cleared = await request(app).delete('/api/history').set(H, id);
    expect(cleared.body).toEqual({ cleared: true, removed: 2 });
    expect((await request(app).get('/api/history').set(H, id)).body.total).toBe(0);
    expect((await request(app).get('/api/saved-routes').set(H, id)).body.total).toBe(1);
  });

  it('keeps only the newest 1000 records', async () => {
    const store = createWorkspaceStore();
    const capped = createApp({ geocoder, store });
    const { workspaceId: id } = (await request(capped).post('/api/session').send({})).body;
    await store.update(id, (w) => { for (let i = 0; i < 1000; i += 1) w.history.push({ id: `old${i}`, at: '2026-01-01T00:00:00Z', found: true, algorithm: 'dijkstra', metric: 'distance', source: { label: 'a' }, destination: { label: 'b' } }); });
    await request(capped).post('/api/routes/shortest').set(H, id).send(coords);
    const h = (await request(capped).get('/api/history').query({ limit: 100 }).set(H, id)).body;
    expect(h.total).toBe(1000);
    expect(h.items[0].id).not.toMatch(/^old/);
    expect(await store.read(id, (w) => w.history[0].id)).toBe('old1'); // old0 was dropped
  });
});

describe('analytics endpoint', () => {
  const coords = { source: { lat: 26.8501, lng: 80.9501 }, destination: { lat: 26.8599, lng: 80.9611 } };

  it('returns an honest empty state for a new workspace', async () => {
    const { workspaceId: id } = await control();
    const a = (await request(app).get('/api/analytics').set(H, id)).body;
    expect(a.totals.routesCalculated).toBe(0);
    expect(a.averages.distanceMeters).toBeNull();
    expect(a.topDestinations).toEqual([]);
    expect(a.trend.points).toHaveLength(30);
  });

  it('is computed from real stored history', async () => {
    const { workspaceId: id } = await control();
    const r1 = await request(app).post('/api/routes/shortest').set(H, id).send({ ...coords, labels: { destination: 'Office' } });
    await request(app).post('/api/routes/astar').set(H, id).send({ ...coords, labels: { destination: 'Office' } });
    await request(app).post('/api/routes/shortest').set(H, id).send({ ...coords, labels: { destination: 'Mall' } });
    await request(app).post('/api/saved-routes').set(H, id).send(savedBody());
    const a = (await request(app).get('/api/analytics').query({ range: '7d', tz: 330 }).set(H, id)).body;
    expect(a.totals).toMatchObject({ routesCalculated: 3, successful: 3, savedRoutes: 1 });
    expect(a.averages.distanceMeters).toBeCloseTo(r1.body.distanceMeters, 5);
    expect(a.topDestinations[0]).toMatchObject({ label: 'Office', count: 2 });
    expect(a.algorithms.find((x) => x.algorithm === 'dijkstra').count).toBe(2);
    expect(a.algorithms.find((x) => x.algorithm === 'astar').count).toBe(1);
    expect(a.trend.points).toHaveLength(7);
    expect(a.trend.points.reduce((s, p) => s + p.count, 0)).toBe(3);
    expect(a.range.tzOffsetMinutes).toBe(330);
  });

  it('validates range and tz, and requires a session', async () => {
    const { workspaceId: id } = await control();
    expect((await request(app).get('/api/analytics').query({ range: '1y' }).set(H, id)).status).toBe(400);
    expect((await request(app).get('/api/analytics').query({ range: 'toString' }).set(H, id)).status).toBe(400);
    expect((await request(app).get('/api/analytics').query({ tz: 9999 }).set(H, id)).status).toBe(400);
    expect((await request(app).get('/api/analytics')).status).toBe(401);
  });
});

describe('persistence through the HTTP API (file store)', () => {
  it('saved routes and history survive a server restart', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'nexora-api-'));
    try {
      const first = createApp({ geocoder, store: createWorkspaceStore({ dir }) });
      const { workspaceId: id } = (await request(first).post('/api/session').send({ label: 'Persist' })).body;
      await request(first).post('/api/saved-routes').set(H, id).send(savedBody());
      await request(first).post('/api/routes/shortest').set(H, id).send({ source: 'N0-0', destination: 'N5-5' });

      const second = createApp({ geocoder, store: createWorkspaceStore({ dir }) }); // "restart"
      expect((await request(second).get('/api/session').set(H, id)).body.label).toBe('Persist');
      expect((await request(second).get('/api/saved-routes').set(H, id)).body.total).toBe(1);
      expect((await request(second).get('/api/history').set(H, id)).body.total).toBe(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
