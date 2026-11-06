import { useCallback, useEffect, useState } from 'react';
import { getGraphStatistics } from '../api/client.js';

/**
 * Loads REAL graph statistics + data-source info from the backend.
 * @returns {{status: 'loading'|'ok'|'error', data: object|null, error: string|null, refresh: () => void}}
 */
export function useGraphStats() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', data: null, error: null });
    getGraphStatistics()
      .then((data) => { if (!cancelled) setState({ status: 'ok', data, error: null }); })
      .catch((err) => { if (!cancelled) setState({ status: 'error', data: null, error: err.message }); });
    return () => { cancelled = true; };
  }, [tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, refresh };
}
