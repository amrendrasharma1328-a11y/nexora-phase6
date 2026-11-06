import { describe, it, expect } from 'vitest';
import { computeAnalytics, localDateKey, lastDateKeys } from '../src/services/analyticsService.js';

const NOW = Date.parse('2026-11-05T10:00:00Z');
const rec = (over = {}) => ({
  id: 'h', at: '2026-11-05T08:00:00Z',
  source: { label: 'A', lat: 1, lng: 1 }, destination: { label: 'Hazratganj', lat: 2, lng: 2 },
  algorithm: 'dijkstra', metric: 'distance', found: true,
  distanceMeters: 1000, estimatedTimeSeconds: 100, executionTimeMs: 2, nodesVisited: 50, dataSource: 'osm', ...over,
});

describe('computeAnalytics', () => {
  it('returns honest zeros/nulls for empty history (no invented numbers)', () => {
    const a = computeAnalytics([], { nowMs: NOW });
    expect(a.totals).toEqual({ routesCalculated: 0, successful: 0, noPath: 0, savedRoutes: 0 });
    expect(a.averages).toEqual({ distanceMeters: null, estimatedTimeSeconds: null, executionTimeMs: null });
    expect(a.topDestinations).toEqual([]);
    expect(a.algorithms.map((x) => [x.algorithm, x.count, x.avgExecutionTimeMs])).toEqual([['dijkstra', 0, null], ['astar', 0, null]]);
    expect(a.trend.points).toHaveLength(30);
    expect(a.trend.points.every((p) => p.count === 0 && p.avgDistanceMeters === null)).toBe(true);
  });

  it('computes totals and averages; no-path records count as calculations but not in distance/time averages', () => {
    const a = computeAnalytics([
      rec({ distanceMeters: 1000, estimatedTimeSeconds: 100, executionTimeMs: 2 }),
      rec({ distanceMeters: 3000, estimatedTimeSeconds: 300, executionTimeMs: 4 }),
      rec({ found: false, distanceMeters: null, estimatedTimeSeconds: null, executionTimeMs: 6 }),
    ], { nowMs: NOW, savedRoutes: 4 });
    expect(a.totals).toEqual({ routesCalculated: 3, successful: 2, noPath: 1, savedRoutes: 4 });
    expect(a.averages.distanceMeters).toBe(2000);
    expect(a.averages.estimatedTimeSeconds).toBe(200);
    expect(a.averages.executionTimeMs).toBe(4);
  });

  it('splits algorithm usage, shares and per-algorithm execution time', () => {
    const a = computeAnalytics([
      rec({ algorithm: 'dijkstra', executionTimeMs: 4, nodesVisited: 100 }),
      rec({ algorithm: 'dijkstra', executionTimeMs: 6, nodesVisited: 120 }),
      rec({ algorithm: 'dijkstra', executionTimeMs: 2, nodesVisited: 80 }),
      rec({ algorithm: 'astar', executionTimeMs: 1, nodesVisited: 30, metric: 'time' }),
    ], { nowMs: NOW });
    const [d, s] = a.algorithms;
    expect(d).toMatchObject({ algorithm: 'dijkstra', count: 3, share: 0.75, avgExecutionTimeMs: 4, avgNodesVisited: 100 });
    expect(s).toMatchObject({ algorithm: 'astar', count: 1, share: 0.25, avgExecutionTimeMs: 1, avgNodesVisited: 30 });
    expect(a.routeTypes).toEqual([{ metric: 'distance', count: 3 }, { metric: 'time', count: 1 }]);
  });

  it('ranks destinations case-insensitively by count, ties broken by most recent, max 5', () => {
    const mk = (label, at) => rec({ destination: { label, lat: 0, lng: 0 }, at });
    const a = computeAnalytics([
      mk('Hazratganj', '2026-11-01T10:00:00Z'), mk('hazratganj', '2026-11-02T10:00:00Z'), mk('HAZRATGANJ', '2026-11-03T10:00:00Z'),
      mk('Alambagh', '2026-11-04T10:00:00Z'), mk('Alambagh', '2026-11-04T11:00:00Z'),
      mk('Charbagh', '2026-11-05T01:00:00Z'), mk('Aminabad', '2026-11-04T05:00:00Z'),
      mk('Gomti Nagar', '2026-11-04T06:00:00Z'), mk('Indira Nagar', '2026-11-04T07:00:00Z'),
    ], { nowMs: NOW });
    expect(a.topDestinations).toHaveLength(5);
    expect(a.topDestinations[0]).toMatchObject({ label: 'HAZRATGANJ', count: 3 });
    expect(a.topDestinations[1]).toMatchObject({ label: 'Alambagh', count: 2 });
    expect(a.topDestinations[2].label).toBe('Charbagh'); // newest of the count-1 ties
  });

  it('filters by range and builds a contiguous daily trend in the viewer time zone', () => {
    const a = computeAnalytics([
      rec({ at: '2026-11-05T08:00:00Z', distanceMeters: 1000 }),
      rec({ at: '2026-11-05T09:00:00Z', distanceMeters: 3000 }),
      rec({ at: '2026-11-03T08:00:00Z' }),
      rec({ at: '2026-09-01T08:00:00Z' }), // outside 7d
    ], { range: '7d', nowMs: NOW });
    expect(a.totals.routesCalculated).toBe(3);
    expect(a.trend.points).toHaveLength(7);
    expect(a.trend.points.at(-1)).toEqual({ date: '2026-11-05', count: 2, avgDistanceMeters: 2000 });
    expect(a.trend.points.find((p) => p.date === '2026-11-04').count).toBe(0);
    expect(a.trend.points.find((p) => p.date === '2026-11-03').count).toBe(1);
  });

  it('"all" covers every record while the trend shows the latest 90 days', () => {
    const a = computeAnalytics([rec({ at: '2026-01-01T00:00:00Z' }), rec()], { range: 'all', nowMs: NOW });
    expect(a.totals.routesCalculated).toBe(2);
    expect(a.trend.days).toBe(90);
    expect(a.range.days).toBeNull();
  });

  it('buckets days by the viewer time zone (IST = +330 min)', () => {
    // 20:00 UTC on Nov 4 is 01:30 on Nov 5 in IST.
    expect(localDateKey(Date.parse('2026-11-04T20:00:00Z'), 330)).toBe('2026-11-05');
    expect(localDateKey(Date.parse('2026-11-04T20:00:00Z'), 0)).toBe('2026-11-04');
    const a = computeAnalytics([rec({ at: '2026-11-04T20:00:00Z' })], { range: '7d', nowMs: NOW, tzOffsetMinutes: 330 });
    expect(a.trend.points.at(-1)).toMatchObject({ date: '2026-11-05', count: 1 });
    expect(lastDateKeys(NOW, 3, 0)).toEqual(['2026-11-03', '2026-11-04', '2026-11-05']);
  });
});
