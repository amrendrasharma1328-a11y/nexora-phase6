import { GraphError } from './errors.js';

export const EARTH_RADIUS_METERS = 6371008.8;

const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * @typedef {{lat: number, lng: number}} LatLng
 */

/**
 * Great-circle distance between two coordinates using the Haversine formula.
 * @param {LatLng} a
 * @param {LatLng} b
 * @returns {number} distance in meters
 */
export function haversineMeters(a, b) {
  for (const p of [a, b]) {
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) {
      throw new GraphError('INVALID_COORDINATES', 'Haversine requires finite lat/lng values');
    }
  }
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}
