import { describe, it, expect } from 'vitest';
import { exclusionReason, travelDirection, parseMaxspeedKmh, speedKmh } from '../src/osm/roadClasses.js';
import { stronglyConnectedComponents, largestComponent } from '../src/engine/scc.js';
import { resolveRegion, parseBbox } from '../src/config/regions.js';
import { buildOverpassQuery } from '../src/osm/overpassClient.js';

describe('road rules', () => {
  it('excludes non-drivable classes, areas, parking aisles and blocked access', () => {
    expect(exclusionReason({ highway: 'footway' })).toBe('not-drivable-class');
    expect(exclusionReason({ highway: 'residential', area: 'yes' })).toBe('area');
    expect(exclusionReason({ highway: 'service', service: 'parking_aisle' })).toBe('service-type');
    expect(exclusionReason({ highway: 'residential', access: 'private' })).toBe('access-access');
    expect(exclusionReason({ highway: 'residential', access: 'no', motor_vehicle: 'yes' })).toBeNull();
    expect(exclusionReason({ highway: 'residential', motor_vehicle: 'no' })).toBe('access-motor_vehicle');
    expect(exclusionReason({ highway: 'residential', access: 'destination' })).toBeNull();
    expect(exclusionReason({ highway: 'primary' })).toBeNull();
    expect(exclusionReason(undefined)).toBe('not-drivable-class');
  });

  it('derives travel direction', () => {
    expect(travelDirection({ highway: 'residential' })).toBe('both');
    expect(travelDirection({ oneway: 'yes' })).toBe('forward');
    expect(travelDirection({ oneway: '1' })).toBe('forward');
    expect(travelDirection({ oneway: '-1' })).toBe('backward');
    expect(travelDirection({ oneway: 'reverse' })).toBe('backward');
    expect(travelDirection({ oneway: 'no', highway: 'motorway' })).toBe('both');
    expect(travelDirection({ junction: 'roundabout' })).toBe('forward');
    expect(travelDirection({ highway: 'motorway' })).toBe('forward');
    expect(travelDirection({ highway: 'motorway_link' })).toBe('forward');
  });

  it('parses maxspeed values', () => {
    expect(parseMaxspeedKmh('50')).toBe(50);
    expect(parseMaxspeedKmh('40 km/h')).toBe(40);
    expect(parseMaxspeedKmh('30 mph')).toBeCloseTo(48.28, 1);
    expect(parseMaxspeedKmh('signals')).toBeNull();
    expect(parseMaxspeedKmh('none')).toBeNull();
    expect(parseMaxspeedKmh(undefined)).toBeNull();
    expect(parseMaxspeedKmh('0')).toBeNull();
    expect(speedKmh({ highway: 'primary', maxspeed: 'none' })).toBe(45);
    expect(speedKmh({ highway: 'primary', maxspeed: '60' })).toBe(60);
  });
});

describe('strongly connected components', () => {
  it('finds components and the largest one', () => {
    const adj = new Map([
      ['a', ['b']], ['b', ['c']], ['c', ['a', 'd']], ['d', ['e']], ['e', ['d']], ['f', []],
    ]);
    const comps = stronglyConnectedComponents(adj).map((c) => [...c].sort()).sort((x, y) => y.length - x.length);
    expect(comps[0]).toEqual(['a', 'b', 'c']);
    expect(comps).toHaveLength(3);
    expect(largestComponent(adj).sort()).toEqual(['a', 'b', 'c']);
    expect(largestComponent(new Map())).toEqual([]);
  });

  it('handles a long chain without stack overflow (iterative)', () => {
    const adj = new Map();
    const n = 200000;
    for (let i = 0; i < n; i += 1) adj.set(String(i), [String((i + 1) % n)]);
    expect(largestComponent(adj)).toHaveLength(n);
  });
});

describe('regions and queries', () => {
  it('defaults to a configurable Lucknow demo region', () => {
    const r = resolveRegion({});
    expect(r.id).toBe('lucknow');
    expect(r.bbox.south).toBeLessThan(r.bbox.north);
  });

  it('supports a custom bounding box and rejects bad input', () => {
    const r = resolveRegion({ NEXORA_BBOX: '12.9,77.5,13.0,77.7', NEXORA_REGION: 'blr', NEXORA_REGION_NAME: 'Bengaluru' });
    expect(r.bbox).toEqual({ south: 12.9, west: 77.5, north: 13.0, east: 77.7 });
    expect(r.name).toBe('Bengaluru');
    expect(() => parseBbox('1,2,3')).toThrow();
    expect(() => parseBbox('10,0,5,1')).toThrow();
    expect(() => resolveRegion({ NEXORA_REGION: 'atlantis' })).toThrow();
  });

  it('builds an Overpass query for drivable roads only', () => {
    const q = buildOverpassQuery({ south: 1, west: 2, north: 3, east: 4 });
    expect(q).toContain('(1,2,3,4)');
    expect(q).toContain('residential');
    expect(q).toContain('out body');
    expect(q.includes('footway')).toBe(false);
  });
});
