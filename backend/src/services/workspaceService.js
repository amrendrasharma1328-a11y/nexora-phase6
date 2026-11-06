import { HttpError } from '../http/httpError.js';
import { StoreError } from '../store/workspaceStore.js';
import { validateSessionLabel } from '../validation/inputs.js';

const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

/** Throws the standard "workspace not found" error when a store call returned null. */
export function requireWorkspace(result) {
  if (result === null) throw new HttpError(401, 'CONTROL_INVALID', 'This control session no longer exists. Request control again.');
  return result;
}

const publicView = (w) => ({ workspaceId: w.id, label: w.label, createdAt: w.createdAt, lastSeenAt: w.lastSeenAt });

/**
 * Control sessions = anonymous workspaces (no accounts, no passwords). See store/workspaceStore.js.
 * @param {{store: ReturnType<import('../store/workspaceStore.js').createWorkspaceStore>, now?: () => Date}} deps
 */
export function createWorkspaceService({ store, now = () => new Date() }) {
  return {
    async requestControl(body) {
      const label = validateSessionLabel(body?.label);
      if (label.error) throw new HttpError(400, 'INVALID_REQUEST', label.error);
      try {
        return publicView(await store.create({ label: label.value }));
      } catch (err) {
        if (err instanceof StoreError && err.code === 'CAPACITY') throw new HttpError(503, 'CAPACITY', 'NEXORA cannot open another control session right now.');
        throw err;
      }
    },

    /** Validates the session and refreshes `lastSeenAt` at most once an hour (avoids a disk write per request). */
    async describe(workspaceId) {
      const view = requireWorkspace(await store.read(workspaceId, (w) => ({
        ...publicView(w),
        counts: { savedRoutes: w.savedRoutes.length, history: w.history.length },
      })));
      if (now().getTime() - new Date(view.lastSeenAt).getTime() > TOUCH_INTERVAL_MS) {
        await store.update(workspaceId, (w) => { w.lastSeenAt = now().toISOString(); });
      }
      return view;
    },

    /** Erase the workspace and everything in it. */
    async erase(workspaceId) {
      requireWorkspace((await store.remove(workspaceId)) ? true : null);
      return { erased: true };
    },
  };
}
