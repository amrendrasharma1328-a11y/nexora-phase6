import { tokens } from './src/design/tokens.js';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: tokens.tailwindColors,
      fontFamily: tokens.fontFamily,
      borderColor: { DEFAULT: 'rgb(var(--nx-border-rgb) / 1)' },
      boxShadow: tokens.shadows,
      spacing: tokens.spacing,
      transitionDuration: tokens.durations,
    },
  },
  plugins: [],
};
