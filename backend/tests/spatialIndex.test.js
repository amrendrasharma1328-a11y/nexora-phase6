import { describe, it, expect } from 'vitest';
import { SpatialIndex } from '../src/osm/spatialIndex.js';
import { buildGraphFromOsm } from '../src/osm/buildGraph.js';
import { haversineMeters } from '../src/engine/geo.js';
import { osmFixture } from './fixtures/osmFixture.js';
import { mulberry32, randomGeoGraph } from './helpers.js';

describe('SpatialIndex', () => {
  const { graph } = buildGraphFromOsm(osmFixture);
  const index = new SpatialIndex(graph);

  it('snaps to the nearest intersection', () => {
    const hit = index.nearest({ lat: 26.8551, lng: 80.9551 });
    expect(hit.id).toBe('5');
    expect(hit.distanceMeters).toBeLessThan(20);
  });

  it('returns null when nothing is within maxMeters', () => {
    expect(index.nearest({ lat: 27.5, lng: 81.5 })).toBeNull();
    expect(index.nearest({ lat: 26.8551, lng: 80.9551 }, { maxMeters: 1 })).toBeNull();
  });

  it('returns null for invalid points or an empty graph', () => {
    expect(index.nearest({ lat: NaN, lng: 1 })).toBeNull();
    expect(index.nearest(null)).toBeNull();
    expect(new SpatialIndex(buildGraphFromOsm({ elements: [] }).graph).nearest({ lat: 1, lng: 1 })).toBeNull();
  });

  it('matches a brute-force nearest-vertex search on random data', () => {
    const g = randomGeoGraph(3, 60);
    const idx = new SpatialIndex(g);
    const rnd = mulberry32(11);
    for (let k = 0; k < 80; k += 1) {
      const p = { lat: 26.78 + rnd() * 0.11, lng: 80.85 + rnd() * 0.11 };
      let best = Infinity;
      for (const v of g.vertices.values()) best = Math.min(best, haversineMeters(p, v));
      const got = idx.nearest(p, { maxMeters: 30000 });
      expect(got).not.toBeNull();
      expect(got.distanceMeters).toBeCloseTo(best, 6);
    }
  });
});
