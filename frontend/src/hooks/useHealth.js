import { useCallback, useEffect, useState } from 'react';

/**
 * Polls the real backend /api/health endpoint once on mount (and on refresh()).
 * @returns {{status: 'loading'|'ok'|'error', data: object|null, error: string|null, refresh: () => void}}
 */
export function useHealth() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', data: null, error: null });
    fetch('/api/health', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Backend responded with HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setState({ status: 'ok', data, error: null }))
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setState({ status: 'error', data: null, error: err.message || 'Backend unreachable' });
      });
    return () => controller.abort();
  }, [tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, refresh };
}
