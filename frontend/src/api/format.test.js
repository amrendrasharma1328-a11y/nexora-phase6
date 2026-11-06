import { describe, it, expect } from 'vitest';
import { distanceInUnit, formatDistance, formatDuration, formatMs, formatPercent } from './format.js';

describe('format', () => {
  it('formats metric distances', () => {
    expect(formatDistance(850)).toBe('850 m');
    expect(formatDistance(1500)).toBe('1.50 km');
    expect(formatDistance(1500, 'km')).toBe('1.50 km');
  });
  it('formats imperial distances (feet under 0.1 mi, miles above)', () => {
    expect(formatDistance(100, 'mi')).toBe('328 ft');
    expect(formatDistance(1609.344, 'mi')).toBe('1.00 mi');
    expect(formatDistance(5000, 'mi')).toBe('3.11 mi');
  });
  it('returns a dash for missing values', () => {
    for (const f of [formatDistance, formatDuration, formatMs, formatPercent]) { expect(f(null)).toBe('—'); expect(f(undefined)).toBe('—'); expect(f(NaN)).toBe('—'); }
  });
  it('converts for chart axes', () => {
    expect(distanceInUnit(2000, 'km')).toBe(2);
    expect(distanceInUnit(1609.344, 'mi')).toBeCloseTo(1, 10);
    expect(distanceInUnit(null)).toBeNull();
  });
  it('formats durations and milliseconds', () => {
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(600)).toBe('10 min');
    expect(formatDuration(5400)).toBe('1 h 30 min');
    expect(formatMs(2.345)).toBe('2.35 ms');
    expect(formatMs(45.67)).toBe('45.7 ms');
    expect(formatMs(250.4)).toBe('250 ms');
    expect(formatPercent(0.583)).toBe('58%');
  });
});
