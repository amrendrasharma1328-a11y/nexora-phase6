/**
 * DEMO DATA ONLY. A deterministic, made-up analytics payload (same shape as GET /api/analytics) used when the
 * user explicitly previews the Analytics page before they have any history. The UI labels it as demo data and
 * never mixes it with real numbers.
 */
function rng(seed) {
  let a = seed;
  return () => { a = (a * 1664525 + 1013904223) % 4294967296; return a / 4294967296; };
}

const DAY_MS = 86_400_000;

export function buildDemoAnalytics(range = '30d', nowMs = Date.now()) {
  const days = { '7d': 7, '30d': 30, '90d': 90, all: 90 }[range] ?? 30;
  const rand = rng(2026);
  const points = Array.from({ length: days }, (_, i) => {
    const date = new Date(nowMs - (days - 1 - i) * DAY_MS).toISOString().slice(0, 10);
    const count = Math.floor(rand() * 9);
    return { date, count, avgDistanceMeters: count ? 2500 + Math.round(rand() * 6000) : null };
  });
  const total = points.reduce((s, p) => s + p.count, 0);
  const dijkstra = Math.round(total * 0.58);
  return {
    demo: true,
    range: { key: range, days: range === 'all' ? null : days, tzOffsetMinutes: 0 },
    totals: { routesCalculated: total, successful: total, noPath: 0, savedRoutes: 6 },
    averages: { distanceMeters: 5400, estimatedTimeSeconds: 780, executionTimeMs: 3.4 },
    algorithms: [
      { algorithm: 'dijkstra', count: dijkstra, share: total ? dijkstra / total : 0, avgExecutionTimeMs: 4.6, avgNodesVisited: 1240, avgDistanceMeters: 5300 },
      { algorithm: 'astar', count: total - dijkstra, share: total ? (total - dijkstra) / total : 0, avgExecutionTimeMs: 2.1, avgNodesVisited: 410, avgDistanceMeters: 5500 },
    ],
    routeTypes: [{ metric: 'distance', count: Math.round(total * 0.6) }, { metric: 'time', count: total - Math.round(total * 0.6) }],
    topDestinations: [
      { label: 'Sample place A', count: 14, lastSearchedAt: new Date(nowMs).toISOString() },
      { label: 'Sample place B', count: 9, lastSearchedAt: new Date(nowMs).toISOString() },
      { label: 'Sample place C', count: 6, lastSearchedAt: new Date(nowMs).toISOString() },
      { label: 'Sample place D', count: 3, lastSearchedAt: new Date(nowMs).toISOString() },
    ],
    trend: { days, points },
    generatedAt: new Date(nowMs).toISOString(),
  };
}
