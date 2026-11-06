/**
 * NEXORA design tokens (single source of truth for JS/Tailwind).
 * Mirrored as CSS variables in src/styles/tokens.css (a test keeps the two in sync).
 *
 * Colors are themeable: Tailwind classes resolve to CSS variables (`rgb(var(--nx-<name>-rgb) / <alpha>)`),
 * so switching `data-theme` on <html> recolors the whole app. `themes` holds the concrete hex values for
 * JS consumers that cannot read CSS variables (map polylines, SVG strokes, the design-system gallery).
 */
export const COLOR_NAMES = ['bg', 'surface', 'primary', 'secondary', 'cyan', 'ink', 'body', 'muted', 'border', 'control'];
export const THEME_IDS = ['dark', 'light', 'contrast'];

export const themes = {
  dark: {
    bg: '#020303', surface: '#090e0b', primary: '#38ff8e', secondary: '#ff65d8', cyan: '#65f8ff',
    ink: '#f8fffa', body: '#d3dbd5', muted: '#c2cbc5', border: '#304c3b', control: '#659579',
  },
  light: {
    bg: '#f2f7f3', surface: '#ffffff', primary: '#0b7a3e', secondary: '#b3127f', cyan: '#006a7a',
    ink: '#06130b', body: '#223027', muted: '#43554a', border: '#aac2b2', control: '#4f7a62',
  },
  contrast: {
    bg: '#000000', surface: '#000000', primary: '#5dff9f', secondary: '#ff8be6', cyan: '#8ff9ff',
    ink: '#ffffff', body: '#ffffff', muted: '#e6e6e6', border: '#8fb59f', control: '#ffffff',
  },
};

const tailwindColors = Object.fromEntries(COLOR_NAMES.map((n) => [n, `rgb(var(--nx-${n}-rgb) / <alpha-value>)`]));

export const tokens = {
  /** Dark-theme hex values (the default theme). Prefer `themes[resolvedTheme]` for anything user-visible. */
  colors: themes.dark,
  /** Tailwind color map: CSS-variable based so themes can recolor classes. */
  tailwindColors,
  fontFamily: {
    sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
    mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
  },
  typography: {
    label: { size: '0.6875rem', tracking: '0.12em', transform: 'uppercase' },
  },
  spacing: { rail: '2px', sidebar: '16rem', header: '4rem' },
  borders: { width: '1px', railWidth: '2px', radius: '0px' },
  shadows: {
    focus: '0 0 0 2px var(--nx-bg), 0 0 0 4px var(--nx-primary)',
    'glow-green': '0 0 0 1px var(--nx-primary), 0 0 12px rgb(var(--nx-primary-rgb) / 0.25)',
    'glow-cyan': '0 0 0 1px var(--nx-cyan), 0 0 12px rgb(var(--nx-cyan-rgb) / 0.2)',
  },
  durations: { fast: '120ms', base: '200ms' },
};
