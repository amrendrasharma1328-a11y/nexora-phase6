import { useMemo } from 'react';
import { useSettings } from '../context/SettingsContext.jsx';
import { distanceInUnit, formatDistance, formatDuration, unitLabel } from '../api/format.js';

/** Formatters bound to the user's distance-unit setting (Settings > Units). */
export function useUnits() {
  const { settings: { units } } = useSettings();
  return useMemo(() => ({
    units,
    unitLabel: unitLabel(units),
    formatDistance: (meters) => formatDistance(meters, units),
    distanceInUnit: (meters) => distanceInUnit(meters, units),
    formatDuration,
  }), [units]);
}
