import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { DEFAULT_SETTINGS, SETTINGS_KEY, loadSettings, resolveMotion, resolveTheme, resolveTiles, safeLocalStorage, sanitizeSettings, saveSettings } from '../settings/settings.js';
import { themes } from '../design/tokens.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';

const SettingsContext = createContext(null);

/**
 * Provides user settings and applies them to the document:
 *  - theme       -> <html data-theme>, <meta name="theme-color">
 *  - motion      -> <html data-motion>
 *  - scanlines   -> <html data-scanlines>
 * Other settings (units, map, routing defaults) are read by the components that use them.
 */
export function SettingsProvider({ children, storage }) {
  const store = useMemo(() => storage ?? safeLocalStorage(), [storage]);
  const initial = useMemo(() => loadSettings(store), [store]);
  const [settings, setSettings] = useState(initial.settings);
  const [persisted, setPersisted] = useState(initial.persisted);
  const prefersLight = useMediaQuery('(prefers-color-scheme: light)');
  const prefersReduced = useMediaQuery('(prefers-reduced-motion: reduce)');

  const theme = resolveTheme(settings.theme, prefersLight);
  const motion = resolveMotion(settings.motion, prefersReduced);
  const tiles = resolveTiles(settings.mapTiles, theme);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.motion = motion;
    root.dataset.scanlines = settings.scanlines ? 'on' : 'off';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themes[theme].bg);
  }, [theme, motion, settings.scanlines]);

  // Keep several tabs in sync.
  useEffect(() => {
    const onStorage = (e) => { if (e.key === SETTINGS_KEY) setSettings(loadSettings(store).settings); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [store]);

  const update = useCallback((patch) => {
    setSettings((prev) => {
      const next = sanitizeSettings({ ...prev, ...patch });
      setPersisted(saveSettings(store, next));
      return next;
    });
  }, [store]);

  const reset = useCallback(() => {
    const next = { ...DEFAULT_SETTINGS };
    setSettings(next);
    setPersisted(saveSettings(store, next));
  }, [store]);

  const value = useMemo(() => ({
    settings, update, reset, persisted,
    resolved: { theme, motion, reduceMotion: motion === 'reduce', tiles },
    palette: themes[theme],
  }), [settings, update, reset, persisted, theme, motion, tiles]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
