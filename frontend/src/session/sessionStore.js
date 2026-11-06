import { safeLocalStorage } from '../settings/settings.js';

/**
 * The browser side of a "control session".
 *
 * NEXORA has no accounts. Requesting control creates an anonymous workspace on the server; its random id is
 * kept here and sent as the X-Nexora-Workspace header. This is NOT authentication: whoever holds the id can
 * use that workspace. `active` is false after "Release control" (the workspace and its data stay on the
 * server, and requesting control again resumes it).
 */
export const SESSION_KEY = 'nexora.session.v1';

// Used only when the browser blocks localStorage, so control still works for the current tab.
let memorySession = null;
export const WORKSPACE_ID_PATTERN = /^ws_[0-9a-f]{32}$/;

/** @returns {{workspaceId: string, label: string, createdAt: string, active: boolean}|null} */
export function readSession(storage = safeLocalStorage()) {
  if (!storage) return memorySession;
  try {
    const raw = JSON.parse(storage.getItem(SESSION_KEY));
    if (!raw || !WORKSPACE_ID_PATTERN.test(raw.workspaceId)) return null;
    return {
      workspaceId: raw.workspaceId,
      label: typeof raw.label === 'string' ? raw.label.slice(0, 40) : '',
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
      active: raw.active === true,
    };
  } catch {
    return null;
  }
}

export function writeSession(session, storage = safeLocalStorage()) {
  if (!storage) { memorySession = session; return false; }
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

export function clearSession(storage = safeLocalStorage()) {
  if (!storage) memorySession = null;
  try { storage?.removeItem(SESSION_KEY); } catch { /* storage blocked: nothing to clear */ }
}

/** The workspace id to send with API calls: only while control is held. */
export function activeWorkspaceId(storage = safeLocalStorage()) {
  const s = readSession(storage);
  return s?.active ? s.workspaceId : null;
}
