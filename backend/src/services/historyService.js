import { randomBytes } from 'node:crypto';
import { LIMITS } from '../validation/inputs.js';
import { requireWorkspace } from './workspaceService.js';

/**
 * Route history: one record per route calculation made through /api/routes/*.
 * Records are appended; the oldest are dropped beyond LIMITS.maxHistoryRecords.
 * @param {{store: ReturnType<import('../store/workspaceStore.js').createWorkspaceStore>, now?: () => Date}} deps
 */
export function createHistoryService({ store, now = () => new Date() }) {
  return {
    /**
     * @param {string} workspaceId
     * @param {{source: object, destination: object, algorithm: string, metric: string, found: boolean,
     *   distanceMeters: number|null, estimatedTimeSeconds: number|null, executionTimeMs: number|null,
     *   nodesVisited: number|null, dataSource: string|null}} entry
     */
    async record(workspaceId, entry) {
      const record = { id: `h_${randomBytes(6).toString('hex')}`, at: now().toISOString(), ...entry };
      return store.update(workspaceId, (w) => {
        w.history.push(record);
        if (w.history.length > LIMITS.maxHistoryRecords) w.history.splice(0, w.history.length - LIMITS.maxHistoryRecords);
        return record;
      });
    },

    /** Newest first. */
    async list(workspaceId, { limit = 25, offset = 0, algorithm } = {}) {
      return requireWorkspace(await store.read(workspaceId, (w) => {
        const all = algorithm ? w.history.filter((h) => h.algorithm === algorithm) : w.history;
        const newestFirst = [];
        for (let i = all.length - 1 - offset; i >= 0 && newestFirst.length < limit; i -= 1) newestFirst.push(all[i]);
        return { items: newestFirst, total: all.length, limit, offset, retention: LIMITS.maxHistoryRecords };
      }));
    },

    /** All records, oldest first (used by analytics). */
    async all(workspaceId) {
      return requireWorkspace(await store.read(workspaceId, (w) => ({ history: w.history.slice(), savedCount: w.savedRoutes.length })));
    },

    async clear(workspaceId) {
      return requireWorkspace(await store.update(workspaceId, (w) => {
        const removed = w.history.length;
        w.history = [];
        return { cleared: true, removed };
      }));
    },
  };
}
