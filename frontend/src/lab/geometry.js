/**
 * Project lat/lng vertices into SVG coordinates (equirectangular, north up),
 * preserving aspect ratio.
 * @param {{id: string, lat: number, lng: number}[]} vertices
 * @param {{width?: number, padding?: number}} [options]
 * @returns {{positions: Map<string, {x: number, y: number}>, width: number, height: number}}
 */
export function projectVertices(vertices, { width = 1000, padding = 30 } = {}) {
  if (!vertices.length) return { positions: new Map(), width, height: width / 2 };
  let minLat = Infinity; let maxLat = -Infinity; let minLng = Infinity; let maxLng = -Infinity;
  for (const v of vertices) {
    minLat = Math.min(minLat, v.lat); maxLat = Math.max(maxLat, v.lat);
    minLng = Math.min(minLng, v.lng); maxLng = Math.max(maxLng, v.lng);
  }
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = Math.max((maxLng - minLng) * kx, 1e-9);
  const spanY = Math.max(maxLat - minLat, 1e-9);
  const scale = (width - 2 * padding) / spanX;
  const height = spanY * scale + 2 * padding;
  const positions = new Map();
  for (const v of vertices) {
    positions.set(v.id, { x: padding + (v.lng - minLng) * kx * scale, y: padding + (maxLat - v.lat) * scale });
  }
  return { positions, width, height };
}
