import { sendError } from '../http/httpError.js';

/**
 * Small in-memory sliding-window limiter keyed by client IP. Enough to stop a script from
 * creating thousands of workspaces; not a replacement for a real gateway in production.
 * @param {{limit: number, windowMs: number, now?: () => number, maxKeys?: number}} options
 */
export function createRateLimiter({ limit, windowMs, now = Date.now, maxKeys = 10_000 }) {
  const hits = new Map(); // key -> timestamps
  return (req, res, next) => {
    const t = now();
    const key = req.ip ?? 'unknown';
    const recent = (hits.get(key) ?? []).filter((ts) => t - ts < windowMs);
    if (recent.length >= limit) {
      const retryAfter = Math.max(1, Math.ceil((windowMs - (t - recent[0])) / 1000));
      res.set('Retry-After', String(retryAfter));
      return sendError(res, 429, 'RATE_LIMITED', `Too many control requests. Try again in ${retryAfter} s.`, { retryAfterSeconds: retryAfter });
    }
    recent.push(t);
    hits.set(key, recent);
    if (hits.size > maxKeys) {
      for (const [k, v] of hits) if (!v.some((ts) => t - ts < windowMs)) hits.delete(k);
    }
    return next();
  };
}
