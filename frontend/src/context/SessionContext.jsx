import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CONTROL_INVALID_EVENT, eraseWorkspace, getSession, requestControl as apiRequestControl } from '../api/client.js';
import { clearSession, readSession, writeSession } from '../session/sessionStore.js';
import { useNotify } from './ToastContext.jsx';

const SessionContext = createContext(null);

/**
 * Control session state ("request control" / "release control").
 * This is NOT authentication: there are no accounts or passwords. See session/sessionStore.js.
 */
export function SessionProvider({ children }) {
  const notify = useNotify();
  const [session, setSession] = useState(() => readSession());
  const [validating, setValidating] = useState(() => readSession()?.active === true);

  const drop = useCallback((message) => {
    clearSession();
    setSession(null);
    if (message) notify.error(message);
  }, [notify]);

  // Verify a remembered session once on load. A network failure keeps it (the app shows backend status itself).
  useEffect(() => {
    const stored = readSession();
    if (!stored?.active) return undefined;
    let cancelled = false;
    getSession(stored.workspaceId)
      .then((info) => {
        if (cancelled) return;
        const next = { ...stored, label: info.label ?? stored.label, createdAt: info.createdAt ?? stored.createdAt };
        writeSession(next);
        setSession(next);
      })
      .catch((err) => { if (!cancelled && err.code === 'CONTROL_INVALID') drop('Your control session no longer exists on the server. Request control again to start a new workspace.'); })
      .finally(() => { if (!cancelled) setValidating(false); });
    return () => { cancelled = true; };
  }, [drop]);

  // Any API call that finds the session gone ends control everywhere.
  useEffect(() => {
    const onInvalid = () => drop('Control was lost: this workspace no longer exists on the server. Request control again.');
    window.addEventListener(CONTROL_INVALID_EVENT, onInvalid);
    return () => window.removeEventListener(CONTROL_INVALID_EVENT, onInvalid);
  }, [drop]);

  /**
   * Take control: resume the remembered workspace if it still exists, otherwise create a new one.
   * @param {string} [label] optional operator name (only used when a new workspace is created)
   * @returns {Promise<{resumed: boolean, replaced: boolean}>}
   */
  const requestControl = useCallback(async (label) => {
    const stored = readSession();
    let replaced = false;
    if (stored) {
      try {
        const info = await getSession(stored.workspaceId);
        const next = { ...stored, active: true, label: info.label ?? stored.label };
        writeSession(next);
        setSession(next);
        return { resumed: true, replaced: false };
      } catch (err) {
        if (err.code !== 'CONTROL_INVALID') throw err;
        clearSession();
        replaced = true;
      }
    }
    const created = await apiRequestControl(label);
    const next = { workspaceId: created.workspaceId, label: created.label, createdAt: created.createdAt, active: true };
    writeSession(next);
    setSession(next);
    return { resumed: false, replaced };
  }, []);

  /**
   * Give up control. `erase: true` also deletes the workspace's saved routes and history on the server;
   * otherwise the data stays and requesting control again resumes it.
   */
  const release = useCallback(async ({ erase = false } = {}) => {
    const current = readSession();
    if (!current) return;
    if (erase) {
      try { await eraseWorkspace(); } catch (err) { if (err.code !== 'CONTROL_INVALID') throw err; }
      clearSession();
      setSession(null);
    } else {
      const next = { ...current, active: false };
      writeSession(next);
      setSession(next);
    }
  }, []);

  const value = useMemo(() => ({
    session, validating, holdsControl: session?.active === true, requestControl, release,
  }), [session, validating, requestControl, release]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
