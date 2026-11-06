/**
 * Analytics over route history. Pure functions: no I/O, fully unit-testable.
 * Every number is derived from stored records. Nothing is estimated or invented.
 */

export const RANGES = { '7d': 7, '30d': 30, '90d': 90, all: null };
export const ALGORITHM_IDS = ['dijkstra', 'astar'];
const ALL_TIME_TREND_DAYS = 90;
const TOP_DESTINATIONS = 5;
const DAY_MS = 86_400_000;

const mean = (values) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null);
const finite = (v) => Number.isFinite(v);

/** Calendar date (YYYY-MM-DD) of an instant in the viewer's local time zone (`tzOffsetMinutes` east of UTC). */
export function localDateKey(instantMs, tzOffsetMinutes) {
  return new Date(instantMs + tzOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

/** The last `days` local dates ending at `nowMs`, oldest first. */
export function lastDateKeys(nowMs, days, tzOffsetMinutes) {
  const keys = [];
  for (let i = days - 1; i >= 0; i -= 1) keys.push(localDateKey(nowMs - i * DAY_MS, tzOffsetMinutes));
  return keys;
}

const destinationKey = (label) => label.trim().toLowerCase();

/**
 * @param {object[]} history route records (any order)
 * @param {{range?: keyof typeof RANGES, nowMs?: number, tzOffsetMinutes?: number, savedRoutes?: number}} [options]
 */
export function computeAnalytics(history, { range = '30d', nowMs = Date.now(), tzOffsetMinutes = 0, savedRoutes = 0 } = {}) {
  const rangeDays = RANGES[range];
  const trendDays = rangeDays ?? ALL_TIME_TREND_DAYS;
  const trendKeys = lastDateKeys(nowMs, trendDays, tzOffsetMinutes);
  const inRangeKeys = rangeDays === null ? null : new Set(trendKeys);

  const records = history.filter((h) => inRangeKeys === null || inRangeKeys.has(localDateKey(Date.parse(h.at), tzOffsetMinutes)));
  const found = records.filter((h) => h.found);

  const algorithms = ALGORITHM_IDS.map((id) => {
    const mine = records.filter((h) => h.algorithm === id);
    return {
      algorithm: id,
      count: mine.length,
      share: records.length ? mine.length / records.length : 0,
      avgExecutionTimeMs: mean(mine.map((h) => h.executionTimeMs).filter(finite)),
      avgNodesVisited: mean(mine.map((h) => h.nodesVisited).filter(finite)),
      avgDistanceMeters: mean(mine.filter((h) => h.found).map((h) => h.distanceMeters).filter(finite)),
    };
  });

  const destinations = new Map();
  for (const h of records) {
    const k = destinationKey(h.destination.label);
    const at = Date.parse(h.at);
    const cur = destinations.get(k);
    if (!cur) destinations.set(k, { label: h.destination.label, count: 1, lastSearchedAt: h.at, lastMs: at });
    else {
      cur.count += 1;
      if (at >= cur.lastMs) { cur.lastMs = at; cur.lastSearchedAt = h.at; cur.label = h.destination.label; }
    }
  }
  const topDestinations = [...destinations.values()]
    .sort((a, b) => b.count - a.count || b.lastMs - a.lastMs)
    .slice(0, TOP_DESTINATIONS)
    .map(({ label, count, lastSearchedAt }) => ({ label, count, lastSearchedAt }));

  const byDay = new Map(trendKeys.map((k) => [k, []]));
  for (const h of records) byDay.get(localDateKey(Date.parse(h.at), tzOffsetMinutes))?.push(h);
  const trend = trendKeys.map((date) => {
    const day = byDay.get(date);
    return { date, count: day.length, avgDistanceMeters: mean(day.filter((h) => h.found).map((h) => h.distanceMeters).filter(finite)) };
  });

  return {
    range: { key: range, days: rangeDays, tzOffsetMinutes },
    totals: {
      routesCalculated: records.length,
      successful: found.length,
      noPath: records.length - found.length,
      savedRoutes,
    },
    averages: {
      distanceMeters: mean(found.map((h) => h.distanceMeters).filter(finite)),
      estimatedTimeSeconds: mean(found.map((h) => h.estimatedTimeSeconds).filter(finite)),
      executionTimeMs: mean(records.map((h) => h.executionTimeMs).filter(finite)),
    },
    algorithms,
    routeTypes: ['distance', 'time'].map((metric) => ({ metric, count: records.filter((h) => h.metric === metric).length })),
    topDestinations,
    trend: { days: trendDays, points: trend },
    generatedAt: new Date(nowMs).toISOString(),
  };
}
