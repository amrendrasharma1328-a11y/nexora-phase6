import { describe, it, expect } from 'vitest';
import { haversineMeters } from '../src/engine/geo.js';
import { errorCode } from './helpers.js';

describe('haversineMeters', () => {
  it('is zero for identical points', () => {
    expect(haversineMeters({ lat: 26.85, lng: 80.95 }, { lat: 26.85, lng: 80.95 })).toBe(0);
  });
  it('one degree of latitude is about 111.2 km', () => {
    expect(haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111195, -2);
  });
  it('is symmetric', () => {
    const a = { lat: 26.85, lng: 80.95 };
    const b = { lat: 26.9, lng: 81.0 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
  });
  it('rejects invalid coordinates', () => {
    expect(errorCode(() => haversineMeters({ lat: NaN, lng: 0 }, { lat: 0, lng: 0 }))).toBe('INVALID_COORDINATES');
  });
});
