import { useEffect, useState } from 'react';

/** Tracks a CSS media query. Returns false where matchMedia is unavailable (tests, old browsers). */
export function useMediaQuery(query) {
  const get = () => (typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof globalThis.matchMedia !== 'function') return undefined;
    const mql = globalThis.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
