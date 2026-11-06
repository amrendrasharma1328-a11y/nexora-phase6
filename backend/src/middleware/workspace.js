import { HttpError, asyncHandler } from '../http/httpError.js';
import { isWorkspaceId } from '../store/workspaceStore.js';

export const WORKSPACE_HEADER = 'X-Nexora-Workspace';

/**
 * Resolves the control-session header into `req.workspaceId`.
 * - `require`: 401 CONTROL_REQUIRED (no header) / CONTROL_INVALID (unknown id).
 * - `optional`: never fails; `req.workspaceId` is only set for a valid, existing session
 *   (used by routing endpoints so a stale session never breaks route calculation).
 * This identifies an anonymous workspace. It is NOT authentication.
 * @param {{store: ReturnType<import('../store/workspaceStore.js').createWorkspaceStore>}} deps
 */
export function createWorkspaceMiddleware({ store }) {
  const lookup = async (req) => {
    const raw = req.get(WORKSPACE_HEADER);
    if (!raw) return { state: 'missing' };
    if (!isWorkspaceId(raw) || !(await store.exists(raw))) return { state: 'invalid' };
    return { state: 'ok', id: raw };
  };

  return {
    require: asyncHandler(async (req, _res, next) => {
      const r = await lookup(req);
      if (r.state === 'missing') throw new HttpError(401, 'CONTROL_REQUIRED', 'Request control first: no control session was provided.');
      if (r.state === 'invalid') throw new HttpError(401, 'CONTROL_INVALID', 'This control session no longer exists. Request control again.');
      req.workspaceId = r.id;
      next();
    }),
    optional: asyncHandler(async (req, _res, next) => {
      const r = await lookup(req);
      if (r.state === 'ok') req.workspaceId = r.id;
      next();
    }),
  };
}
