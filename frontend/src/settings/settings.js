/**
 * User settings: schema, defaults, validation and persistence. Pure JavaScript, no React.
 * Settings live in this browser's localStorage (they are per-device preferences, not workspace data),
 * so they work before control is requested and on the landing page.
 */

export const SETTINGS_KEY = 'nexora.settings.v1';

export const OPTIONS = {
  theme: ['system', 'dark', 'light', 'contrast'],
  motion: ['system', 'reduced', 'full'],
  units: ['km', 'mi'],
  defaultAlgorithm: ['dijkstra', 'astar'],
  defaultRouteType: ['shortest', 'fastest'],
  mapTiles: ['auto', 'dark', 'standard'],
  mapZoom: [11, 12, 13, 14, 15, 16],
};

export const DEFAULT_SETTINGS = Object.freeze({
  theme: 'dark',
  scanlines: true,
  motion: 'system',
  units: 'km',
  defaultAlgorithm: 'dijkstra',
  defaultRouteType: 'shortest',
  mapTiles: 'auto',
  mapZoom: 13,
  mapAutoFit: true,
});

/** Keep only known keys with valid values; anything else falls back to the default. */
export function sanitizeSettings(raw) {
  const src = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const value = src[key];
    if (typeof DEFAULT_SETTINGS[key] === 'boolean') {
      if (typeof value === 'boolean') out[key] = value;
    } else if (OPTIONS[key]?.includes(value)) {
      out[key] = value;
    }
  }
  return out;
}

/** @param {Storage|null} storage @returns {{settings: object, persisted: boolean}} */
export function loadSettings(storage) {
  if (!storage) return { settings: { ...DEFAULT_SETTINGS }, persisted: false };
  try {
    const text = storage.getItem(SETTINGS_KEY);
    return { settings: sanitizeSettings(text ? JSON.parse(text) : null), persisted: true };
  } catch {
    return { settings: { ...DEFAULT_SETTINGS }, persisted: false };
  }
}

/** @returns {boolean} true when the write succeeded */
export function saveSettings(storage, settings) {
  if (!storage) return false;
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(sanitizeSettings(settings)));
    return true;
  } catch {
    return false;
  }
}

/** localStorage, or null when the browser blocks it (private mode, disabled storage). */
export function safeLocalStorage() {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = '__nexora_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/** @returns {'dark'|'light'|'contrast'} */
export function resolveTheme(setting, prefersLight) {
  if (setting === 'system') return prefersLight ? 'light' : 'dark';
  return setting;
}

/** @returns {'reduce'|'full'} */
export function resolveMotion(setting, prefersReduced) {
  if (setting === 'reduced') return 'reduce';
  if (setting === 'full') return 'full';
  return prefersReduced ? 'reduce' : 'full';
}

/** Map tiles: "auto" follows the theme (dark tint on dark themes, standard OSM colors on light). @returns {'dark'|'standard'} */
export function resolveTiles(setting, resolvedTheme) {
  if (setting === 'dark' || setting === 'standard') return setting;
  return resolvedTheme === 'light' ? 'standard' : 'dark';
}
