import { describe, it, expect } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadGraphForRegion } from '../src/osm/loadGraph.js';
import { saveCache, loadCache, fetchRoadNetwork } from '../src/osm/overpassClient.js';
import { osmFixture } from './fixtures/osmFixture.js';

const region = { id: 'testville', name: 'Testville', bbox: { south: 26.8, west: 80.9, north: 26.9, east: 81.0 } };
const quiet = { warn: () => {} };
const res = (status, body) => ({ ok: status < 400, status, json: async () => body });

describe('graph loading and Overpass client', () => {
  it('sample mode returns the synthetic graph, labelled as sample', async () => {
    const r = await loadGraphForRegion({ region, mode: 'sample', logger: quiet });
    expect(r.dataSource.type).toBe('sample');
  });

  it('auto mode falls back to the sample graph (with a warning) when nothing is cached', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'nexora-'));
    const warnings = [];
    const r = await loadGraphForRegion({ region, mode: 'auto', cacheDir: dir, logger: { warn: (m) => warnings.push(m) } });
    expect(r.dataSource.type).toBe('sample');
    expect(warnings).toHaveLength(1);
  });

  it('osm mode throws when nothing is cached', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'nexora-'));
    let err = null;
    try { await loadGraphForRegion({ region, mode: 'osm', cacheDir: dir, logger: quiet }); } catch (e) { err = e; }
    expect(err).not.toBeNull();
  });

  it('loads cached OSM data and reports provenance, attribution and the not-live-traffic note', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'nexora-'));
    await saveCache(region.id, region, osmFixture, { dir });
    expect((await loadCache(region.id, { dir })).meta.regionName).toBe('Testville');
    const r = await loadGraphForRegion({ region, mode: 'auto', cacheDir: dir, logger: quiet });
    expect(r.dataSource.type).toBe('osm');
    expect(r.dataSource.attribution).toContain('OpenStreetMap');
    expect(r.dataSource.license).toContain('ODbL');
    expect(r.dataSource.notes.join(' ')).toContain('NOT live traffic');
    expect(r.graph.statistics().vertexCount).toBe(9);
  });

  it('fetchRoadNetwork posts the query with an identifying User-Agent and validates the response', async () => {
    let seen = null;
    const ok = await fetchRoadNetwork(region.bbox, { fetchImpl: async (url, init) => { seen = { url, init }; return res(200, { elements: [] }); }, userAgent: 'ua-test', endpoint: 'https://overpass.example/api' });
    expect(ok.elements).toEqual([]);
    expect(seen.init.method).toBe('POST');
    expect(seen.init.headers['User-Agent']).toBe('ua-test');
    expect(decodeURIComponent(seen.init.body)).toContain('26.8,80.9,26.9,81');
  });

  it('fetchRoadNetwork reports rate limits, HTTP errors and Overpass remarks', async () => {
    const attempt = async (responder) => { try { await fetchRoadNetwork(region.bbox, { fetchImpl: async () => responder() }); return null; } catch (e) { return e.message; } };
    expect(await attempt(() => res(429, {}))).toContain('rate limit');
    expect(await attempt(() => res(504, {}))).toContain('504');
    expect(await attempt(() => res(200, { elements: [], remark: 'runtime error: Query timed out' }))).toContain('smaller bounding box');
    expect(await attempt(() => res(200, { nope: 1 }))).toContain('elements');
  });
});
