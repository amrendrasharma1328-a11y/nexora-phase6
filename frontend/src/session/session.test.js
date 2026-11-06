import { describe, it, expect } from 'vitest';
import { SESSION_KEY, activeWorkspaceId, clearSession, readSession, writeSession } from './sessionStore.js';
import { validateOperatorName, validateRouteName } from './validation.js';
import { defaultRouteName, metricToRouteType, routeTypeToMetric, samePlace } from '../routing/routeTypes.js';
import { buildDemoAnalytics } from '../data/demoAnalytics.js';

const memoryStorage = () => {
  const d = {};
  return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = String(v); }, removeItem: (k) => { delete d[k]; } };
};
const ID = `ws_${'a'.repeat(32)}`;

describe('session store', () => {
  it('stores, reads and clears a session; only an active one yields a workspace id', () => {
    const s = memoryStorage();
    expect(readSession(s)).toBeNull();
    writeSession({ workspaceId: ID, label: 'Amrendra', createdAt: '2026-11-05T00:00:00Z', active: true }, s);
    expect(readSession(s)).toMatchObject({ workspaceId: ID, label: 'Amrendra', active: true });
    expect(activeWorkspaceId(s)).toBe(ID);
    writeSession({ ...readSession(s), active: false }, s);
    expect(activeWorkspaceId(s)).toBeNull();
    expect(readSession(s).workspaceId).toBe(ID); // released, data key remembered
    clearSession(s);
    expect(readSession(s)).toBeNull();
  });
  it('rejects tampered or malformed stored values', () => {
    const s = memoryStorage();
    for (const raw of ['{bad', JSON.stringify({ workspaceId: '../../x', active: true }), JSON.stringify({ workspaceId: 'ws_123' }), 'null']) {
      s.setItem(SESSION_KEY, raw);
      expect(readSession(s)).toBeNull();
      expect(activeWorkspaceId(s)).toBeNull();
    }
  });
  it('falls back to memory when storage is unavailable', () => {
    writeSession({ workspaceId: ID, label: '', createdAt: '', active: true }, null);
    expect(readSession(null)?.workspaceId).toBe(ID);
    clearSession(null);
    expect(readSession(null)).toBeNull();
  });
});

describe('form validation', () => {
  it('operator name is optional but constrained', () => {
    expect(validateOperatorName('')).toEqual({ value: '' });
    expect(validateOperatorName('  Amrendra   Sharma ')).toEqual({ value: 'Amrendra Sharma' });
    expect(validateOperatorName('x'.repeat(41)).error).toMatch(/40/);
    expect(validateOperatorName('<b>').error).toBeDefined();
  });
  it('route name is required and bounded', () => {
    expect(validateRouteName('').error).toBeDefined();
    expect(validateRouteName('   ').error).toBeDefined();
    expect(validateRouteName('a'.repeat(81)).error).toMatch(/80/);
    expect(validateRouteName('  Home  to office ')).toEqual({ value: 'Home to office' });
    expect(validateRouteName('bad\u0007').error).toBeDefined();
  });
});

describe('routing helpers', () => {
  it('maps route type and metric both ways', () => {
    expect(metricToRouteType('time')).toBe('fastest');
    expect(metricToRouteType('distance')).toBe('shortest');
    expect(routeTypeToMetric('fastest')).toBe('time');
    expect(routeTypeToMetric('shortest')).toBe('distance');
  });
  it('detects identical places and builds a short default name', () => {
    expect(samePlace({ lat: 26.85, lng: 80.95 }, { lat: 26.850001, lng: 80.950001 })).toBe(true);
    expect(samePlace({ lat: 26.85, lng: 80.95 }, { lat: 26.86, lng: 80.95 })).toBe(false);
    expect(defaultRouteName({ label: 'Charbagh, Lucknow, UP' }, { label: 'Hazratganj, Lucknow' })).toBe('Charbagh to Hazratganj');
    expect(defaultRouteName({ label: 'a'.repeat(60) }, { label: 'b'.repeat(60) }).length).toBeLessThanOrEqual(80);
  });
});

describe('demo analytics', () => {
  it('is flagged as demo, deterministic and shaped like the real payload', () => {
    const a = buildDemoAnalytics('30d', 1_700_000_000_000);
    const b = buildDemoAnalytics('30d', 1_700_000_000_000);
    expect(a.demo).toBe(true);
    expect(a).toEqual(b);
    expect(a.trend.points).toHaveLength(30);
    expect(a.algorithms.map((x) => x.algorithm)).toEqual(['dijkstra', 'astar']);
    expect(a.totals.routesCalculated).toBe(a.trend.points.reduce((s, p) => s + p.count, 0));
    expect(a.algorithms[0].count + a.algorithms[1].count).toBe(a.totals.routesCalculated);
  });
});
