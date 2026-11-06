import { randomBytes } from 'node:crypto';
import { HttpError } from '../http/httpError.js';
import { LIMITS, validateSavedRoute } from '../validation/inputs.js';
import { requireWorkspace } from './workspaceService.js';

const key = (p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
const sameRoute = (a, b) =>
  a.algorithm === b.algorithm && a.metric === b.metric && key(a.source) === key(b.source) && key(a.destination) === key(b.destination);

/**
 * Saved routes are stored as the request that produced them (places, algorithm, route type) plus the
 * distance/time shown at save time. Geometry is not stored: opening a saved route recalculates it
 * against the current road graph, so it can never go stale.
 * @param {{store: ReturnType<import('../store/workspaceStore.js').createWorkspaceStore>, now?: () => Date}} deps
 */
export function createSavedRoutesService({ store, now = () => new Date() }) {
  return {
    async list(workspaceId) {
      const items = requireWorkspace(await store.read(workspaceId, (w) => [...w.savedRoutes].reverse()));
      return { items, total: items.length, limit: LIMITS.maxSavedRoutes };
    },

    async get(workspaceId, id) {
      const found = requireWorkspace(await store.read(workspaceId, (w) => w.savedRoutes.find((r) => r.id === id) ?? false));
      if (!found) throw new HttpError(404, 'NOT_FOUND', 'Saved route not found');
      return found;
    },

    async create(workspaceId, body) {
      const parsed = validateSavedRoute(body);
      if (parsed.error) throw new HttpError(400, 'INVALID_REQUEST', parsed.error);
      const created = await store.update(workspaceId, (w) => {
        if (w.savedRoutes.length >= LIMITS.maxSavedRoutes) {
          throw new HttpError(422, 'LIMIT_REACHED', `You can keep up to ${LIMITS.maxSavedRoutes} saved routes. Delete one to save another.`);
        }
        const dup = w.savedRoutes.find((r) => sameRoute(r, parsed.value));
        if (dup) throw new HttpError(409, 'DUPLICATE_ROUTE', `This route is already saved as "${dup.name}".`, { existingId: dup.id, existingName: dup.name });
        const record = { id: `sr_${randomBytes(6).toString('hex')}`, ...parsed.value, createdAt: now().toISOString() };
        w.savedRoutes.push(record);
        return record;
      });
      return requireWorkspace(created);
    },

    async remove(workspaceId, id) {
      const removed = requireWorkspace(await store.update(workspaceId, (w) => {
        const i = w.savedRoutes.findIndex((r) => r.id === id);
        if (i === -1) return false;
        w.savedRoutes.splice(i, 1);
        return true;
      }));
      if (removed === false) throw new HttpError(404, 'NOT_FOUND', 'Saved route not found');
      return { deleted: true, id };
    },
  };
}
