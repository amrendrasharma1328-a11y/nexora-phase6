import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_SETTINGS, SETTINGS_KEY, loadSettings, resolveMotion, resolveTheme, resolveTiles, sanitizeSettings, saveSettings } from './settings.js';
import { COLOR_NAMES, themes } from '../design/tokens.js';

const memoryStorage = (initial = {}) => {
  const data = { ...initial };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; }, data };
};

describe('settings', () => {
  it('sanitize keeps valid values and falls back for anything unknown or malformed', () => {
    const s = sanitizeSettings({ theme: 'light', units: 'mi', mapZoom: 15, scanlines: false, motion: 'warp', defaultAlgorithm: 'bfs', mapZoom2: 1, mapAutoFit: 'yes' });
    expect(s).toMatchObject({ theme: 'light', units: 'mi', mapZoom: 15, scanlines: false, motion: DEFAULT_SETTINGS.motion, defaultAlgorithm: 'dijkstra', mapAutoFit: true });
    expect(Object.keys(s).sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
    for (const bad of [null, undefined, 'x', 5, [], [1]]) expect(sanitizeSettings(bad)).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips through storage and survives corrupt JSON', () => {
    const store = memoryStorage();
    expect(saveSettings(store, { ...DEFAULT_SETTINGS, units: 'mi', theme: 'contrast' })).toBe(true);
    expect(loadSettings(store)).toEqual({ settings: { ...DEFAULT_SETTINGS, units: 'mi', theme: 'contrast' }, persisted: true });
    const broken = memoryStorage({ [SETTINGS_KEY]: '{oops' });
    expect(loadSettings(broken)).toEqual({ settings: DEFAULT_SETTINGS, persisted: false });
  });

  it('reports non-persistence when storage is missing or throws', () => {
    expect(loadSettings(null).persisted).toBe(false);
    expect(saveSettings(null, DEFAULT_SETTINGS)).toBe(false);
    const full = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    expect(saveSettings(full, DEFAULT_SETTINGS)).toBe(false);
  });

  it('resolves system theme, motion and map tiles', () => {
    expect(resolveTheme('system', true)).toBe('light');
    expect(resolveTheme('system', false)).toBe('dark');
    expect(resolveTheme('contrast', true)).toBe('contrast');
    expect(resolveMotion('system', true)).toBe('reduce');
    expect(resolveMotion('system', false)).toBe('full');
    expect(resolveMotion('full', true)).toBe('full');
    expect(resolveMotion('reduced', false)).toBe('reduce');
    expect(resolveTiles('auto', 'light')).toBe('standard');
    expect(resolveTiles('auto', 'dark')).toBe('dark');
    expect(resolveTiles('auto', 'contrast')).toBe('dark');
    expect(resolveTiles('standard', 'dark')).toBe('standard');
  });
});

describe('theme tokens', () => {
  const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');
  const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');
  const block = (selector) => css.split(selector)[1].split('}')[0];

  it('tokens.css matches the JS palettes for every theme', () => {
    for (const [theme, selector] of [['dark', ":root[data-theme='dark'] {"], ['light', ":root[data-theme='light'] {"], ['contrast', ":root[data-theme='contrast'] {"]]) {
      const b = block(selector);
      for (const name of COLOR_NAMES) expect(b, `${theme}.${name}`).toContain(`--nx-${name}-rgb: ${channels(themes[theme][name])};`);
    }
  });

  const lum = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

  it('text colors meet WCAG AA (4.5:1) on bg and surface in every theme; control borders meet 3:1', () => {
    for (const [theme, t] of Object.entries(themes)) {
      for (const text of ['ink', 'body', 'muted', 'primary', 'secondary', 'cyan']) {
        for (const ground of ['bg', 'surface']) expect(ratio(t[text], t[ground]), `${theme} ${text} on ${ground}`).toBeGreaterThanOrEqual(4.5);
      }
      for (const ground of ['bg', 'surface']) expect(ratio(t.control, t[ground]), `${theme} control on ${ground}`).toBeGreaterThanOrEqual(3);
      expect(ratio(t.bg, t.primary), `${theme} button text`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
