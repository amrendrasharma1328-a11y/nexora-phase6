import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads data with loading / ok / error states and a manual reload.
 * Previous data stays available while reloading (`refreshing`), so lists do not flash empty.
 * @template T
 * @param {() => Promise<T>} fetcher
 * @param {any[]} deps re-fetch when these change
 * @returns {{status: 'loading'|'ok'|'error', data: T|null, error: string|null, refreshing: boolean, reload: () => void, setData: (fn: (d: T|null) => T|null) => void}}
 */
export function useResource(fetcher, deps = []) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, status: 'loading', error: null }));
    fetcherRef.current()
      .then((data) => { if (!cancelled) setState({ status: 'ok', data, error: null }); })
      .catch((err) => { if (!cancelled) setState((s) => ({ status: 'error', data: s.data, error: err.message ?? 'Something went wrong' })); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((fn) => setState((s) => ({ ...s, data: fn(s.data) })), []);
  return { ...state, refreshing: state.status === 'loading' && state.data !== null, reload, setData };
}
