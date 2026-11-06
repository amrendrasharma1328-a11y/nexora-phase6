import { describe, it, expect } from 'vitest';
import { createGeocoder } from '../src/osm/geocoder.js';

const bbox = { south: 26.82, west: 80.9, north: 26.9, east: 81.0 };
const row = (name, lat, lon) => ({ display_name: name, lat: String(lat), lon: String(lon), category: 'place', type: 'suburb', osm_type: 'node', osm_id: 1 });

function setup(responder, extra = {}) {
  let t = 0;
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), headers: init.headers, at: t });
    return responder(String(url));
  };
  const geocoder = createGeocoder({ bbox, fetchImpl, now: () => t, sleep: async (ms) => { t += ms; }, userAgent: 'test-agent/1.0', baseUrl: 'https://geo.example', ...extra });
  return { geocoder, calls, advance: (ms) => { t += ms; } };
}
const ok = (data) => ({ ok: true, status: 200, json: async () => data });

describe('geocoder (Nominatim policy compliance)', () => {
  it('builds a bounded search request with an identifying User-Agent', async () => {
    const { geocoder, calls } = setup(() => ok([row('Hazratganj', 26.85, 80.94)]));
    const results = await geocoder.search('Hazratganj');
    expect(results).toEqual([{ displayName: 'Hazratganj', lat: 26.85, lng: 80.94, category: 'place', type: 'suburb', osmType: 'node', osmId: 1 }]);
    const u = new URL(calls[0].url);
    expect(u.pathname).toBe('/search');
    expect(u.searchParams.get('q')).toBe('Hazratganj');
    expect(u.searchParams.get('bounded')).toBe('1');
    expect(u.searchParams.get('viewbox')).toBe('80.9,26.9,81,26.82');
    expect(u.searchParams.get('format')).toBe('jsonv2');
    expect(calls[0].headers['User-Agent']).toBe('test-agent/1.0');
  });

  it('drops results outside the region and malformed rows', async () => {
    const { geocoder } = setup(() => ok([row('inside', 26.85, 80.95), row('outside', 28.6, 77.2), { display_name: 'bad', lat: 'x', lon: 'y' }]));
    const r = await geocoder.search('anything');
    expect(r.map((x) => x.displayName)).toEqual(['inside']);
  });

  it('caches repeated queries (no second upstream request)', async () => {
    const { geocoder, calls } = setup(() => ok([row('A', 26.85, 80.95)]));
    await geocoder.search('Alambagh');
    await geocoder.search('  alambagh ');
    expect(calls).toHaveLength(1);
  });

  it('refreshes the cache after the TTL', async () => {
    const { geocoder, calls, advance } = setup(() => ok([]), { cacheTtlMs: 1000 });
    await geocoder.search('Charbagh');
    advance(2000);
    await geocoder.search('Charbagh');
    expect(calls).toHaveLength(2);
  });

  it('spaces upstream requests at least minIntervalMs apart (even when fired concurrently)', async () => {
    const { geocoder, calls } = setup(() => ok([]));
    await Promise.all([geocoder.search('one'), geocoder.search('two'), geocoder.search('three')]);
    expect(calls).toHaveLength(3);
    expect(calls[1].at - calls[0].at).toBeGreaterThanOrEqual(1100);
    expect(calls[2].at - calls[1].at).toBeGreaterThanOrEqual(1100);
  });

  it('rejects invalid queries without calling upstream', async () => {
    const { geocoder, calls } = setup(() => ok([]));
    for (const q of ['', ' ', 'a', undefined, 'x'.repeat(201)]) {
      let code = null;
      try { await geocoder.search(q); } catch (e) { code = e.code; }
      expect(code).toBe('INVALID_QUERY');
    }
    expect(calls).toHaveLength(0);
  });

  it('maps upstream failures to API errors', async () => {
    const cases = [
      [() => ({ ok: false, status: 429, json: async () => ({}) }), 'GEOCODER_RATE_LIMITED', 503],
      [() => ({ ok: false, status: 500, json: async () => ({}) }), 'GEOCODER_ERROR', 502],
      [() => ok({ not: 'an array' }), 'GEOCODER_ERROR', 502],
    ];
    for (const [responder, code, status] of cases) {
      const { geocoder } = setup(responder);
      let err = null;
      try { await geocoder.search('failing query'); } catch (e) { err = e; }
      expect(err.code).toBe(code);
      expect(err.status).toBe(status);
    }
  });

  it('maps network errors to GEOCODER_UNAVAILABLE and does not cache failures', async () => {
    let fail = true;
    const { geocoder, calls } = setup(() => { if (fail) throw new Error('boom'); return ok([row('ok', 26.85, 80.95)]); });
    let err = null;
    try { await geocoder.search('Gomti Nagar'); } catch (e) { err = e; }
    expect(err.code).toBe('GEOCODER_UNAVAILABLE');
    fail = false;
    expect((await geocoder.search('Gomti Nagar'))).toHaveLength(1);
    expect(calls).toHaveLength(2);
  });
});
