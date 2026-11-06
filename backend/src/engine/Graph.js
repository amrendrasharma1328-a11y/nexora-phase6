import { GraphError } from './errors.js';
import { haversineMeters } from './geo.js';

/**
 * @typedef {Object} Edge
 * @property {string} from
 * @property {string} to
 * @property {number} distance  road length in meters
 * @property {number|null} time estimated travel time in seconds (assumed speeds, NOT live traffic)
 * @property {string|null} name
 * @property {string|null} roadType
 * @property {{lat: number, lng: number}[]|null} geometry road shape from `from` to `to` (optional)
 * @property {string|null} wayId source way id (optional)
 */

/**
 * Weighted directed graph (adjacency list).
 * Intersections = vertices, road segments = edges.
 * A two-way road is two directed edges; a one-way road is a single directed edge.
 * Vertex ids are normalised to strings.
 */
export class Graph {
  /** @param {{name?: string}} [options] */
  constructor({ name = 'graph' } = {}) {
    this.name = name;
    /** @type {Map<string, {id: string, lat?: number, lng?: number, [k: string]: any}>} */
    this.vertices = new Map();
    /** @type {Map<string, Edge[]>} */
    this.adjacency = new Map();
    this.edgeCount = 0;
    this.scalesCache = null;
  }

  /** @returns {string} normalised id; throws GraphError for unusable ids */
  normalizeId(id) {
    if ((typeof id !== 'string' && typeof id !== 'number') || id === '' || Number.isNaN(id)) {
      throw new GraphError('INVALID_VERTEX_ID', 'Vertex id must be a non-empty string or number');
    }
    return String(id);
  }

  /**
   * @param {string|number} id
   * @param {{lat?: number, lng?: number, [k: string]: any}} [data]
   */
  addVertex(id, data = {}) {
    const key = this.normalizeId(id);
    if (this.vertices.has(key)) throw new GraphError('DUPLICATE_VERTEX', `Vertex "${key}" already exists`);
    const { lat, lng } = data;
    if (lat !== undefined || lng !== undefined) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        throw new GraphError('INVALID_COORDINATES', `Vertex "${key}" has invalid lat/lng`);
      }
    }
    this.vertices.set(key, { ...data, id: key });
    this.adjacency.set(key, []);
    this.scalesCache = null;
    return this;
  }

  hasVertex(id) {
    return (typeof id === 'string' || typeof id === 'number') && this.vertices.has(String(id));
  }

  getVertex(id) {
    return this.vertices.get(String(id)) ?? null;
  }

  /** @returns {string[]} all vertex ids */
  getVertexIds() {
    return [...this.vertices.keys()];
  }

  /** @returns {Edge[]} outgoing edges of a vertex */
  getNeighbors(id) {
    const edges = this.adjacency.get(String(id));
    if (!edges) throw new GraphError('UNKNOWN_VERTEX', `Vertex "${id}" does not exist`);
    return edges;
  }

  /** @returns {Edge|null} cheapest (by distance) directed edge from -> to, if any */
  getEdge(from, to) {
    const edges = this.adjacency.get(String(from));
    if (!edges) return null;
    let best = null;
    for (const e of edges) if (e.to === String(to) && (!best || e.distance < best.distance)) best = e;
    return best;
  }

  /**
   * Add one directed edge (also used for one-way roads).
   * @param {string|number} from
   * @param {string|number} to
   * @param {number} distance meters, finite and >= 0
   * @param {{time?: number, name?: string, roadType?: string, geometry?: {lat: number, lng: number}[], wayId?: string}} [options]
   */
  addDirectedEdge(from, to, distance, options = {}) {
    const a = this.normalizeId(from);
    const b = this.normalizeId(to);
    for (const v of [a, b]) {
      if (!this.vertices.has(v)) throw new GraphError('UNKNOWN_VERTEX', `Vertex "${v}" does not exist`);
    }
    if (!Number.isFinite(distance) || distance < 0) {
      throw new GraphError('INVALID_WEIGHT', 'Edge distance must be a finite number >= 0');
    }
    const { time = null, name = null, roadType = null, geometry = null, wayId = null } = options;
    if (time !== null && (!Number.isFinite(time) || time < 0)) {
      throw new GraphError('INVALID_WEIGHT', 'Edge time must be a finite number >= 0');
    }
    this.adjacency.get(a).push({ from: a, to: b, distance, time, name, roadType, geometry, wayId });
    this.edgeCount += 1;
    this.scalesCache = null;
    return this;
  }

  /** Add a two-way road (two directed edges with the same weights). */
  addBidirectionalEdge(from, to, distance, options = {}) {
    this.addDirectedEdge(from, to, distance, options);
    const reverse = options.geometry ? { ...options, geometry: [...options.geometry].reverse() } : options;
    this.addDirectedEdge(to, from, distance, reverse);
    return this;
  }

  /** @param {{bidirectional?: boolean, time?: number, name?: string, roadType?: string}} [options] */
  addEdge(from, to, distance, options = {}) {
    return options.bidirectional
      ? this.addBidirectionalEdge(from, to, distance, options)
      : this.addDirectedEdge(from, to, distance, options);
  }

  /**
   * @param {Edge} edge
   * @param {'distance'|'time'} metric
   * @returns {number|null} weight, or null if the edge has no weight for that metric
   */
  getWeight(edge, metric) {
    return metric === 'time' ? edge.time : edge.distance;
  }

  /**
   * Scale factors that keep the A* geographic heuristic admissible and unit-compatible.
   * - minDistanceRatio: min(edge.distance / haversine(endpoints)), capped at 1.
   *   Multiplying the straight-line distance by it never overestimates remaining road distance.
   * - maxSpeedMps: max(haversine / edge.time) in m/s; straight-line distance / maxSpeed never
   *   overestimates remaining travel time. Infinity (=> heuristic 0) if an edge has zero time.
   */
  getHeuristicScales() {
    if (this.scalesCache) return this.scalesCache;
    let minDistanceRatio = 1;
    let maxSpeedMps = 0;
    let zeroTime = false;
    for (const edges of this.adjacency.values()) {
      for (const e of edges) {
        const a = this.vertices.get(e.from);
        const b = this.vertices.get(e.to);
        if (a.lat === undefined || b.lat === undefined) continue;
        const straight = haversineMeters(a, b);
        if (straight === 0) continue;
        minDistanceRatio = Math.min(minDistanceRatio, e.distance / straight);
        if (e.time !== null) {
          if (e.time <= 0) zeroTime = true;
          else maxSpeedMps = Math.max(maxSpeedMps, straight / e.time);
        }
      }
    }
    this.scalesCache = {
      minDistanceRatio,
      maxSpeedMps: zeroTime ? Infinity : maxSpeedMps,
    };
    return this.scalesCache;
  }

  /** @returns {object} summary statistics of the graph */
  statistics() {
    const keys = new Set();
    for (const edges of this.adjacency.values()) for (const e of edges) keys.add(`${e.from}\u0000${e.to}`);
    let oneWay = 0;
    let withTime = 0;
    let totalDistance = 0;
    let isolated = 0;
    const inDegree = new Map();
    for (const edges of this.adjacency.values()) {
      for (const e of edges) {
        if (!keys.has(`${e.to}\u0000${e.from}`)) oneWay += 1;
        if (e.time !== null) withTime += 1;
        totalDistance += e.distance;
        inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
      }
    }
    let withCoords = 0;
    let box = null;
    for (const [id, v] of this.vertices) {
      if ((this.adjacency.get(id).length === 0) && !inDegree.has(id)) isolated += 1;
      if (v.lat !== undefined) {
        withCoords += 1;
        box = box
          ? { minLat: Math.min(box.minLat, v.lat), maxLat: Math.max(box.maxLat, v.lat), minLng: Math.min(box.minLng, v.lng), maxLng: Math.max(box.maxLng, v.lng) }
          : { minLat: v.lat, maxLat: v.lat, minLng: v.lng, maxLng: v.lng };
      }
    }
    const n = this.vertices.size;
    return {
      name: this.name,
      vertexCount: n,
      edgeCount: this.edgeCount,
      oneWayEdgeCount: oneWay,
      edgesWithTime: withTime,
      verticesWithCoordinates: withCoords,
      isolatedVertexCount: isolated,
      averageOutDegree: n === 0 ? 0 : this.edgeCount / n,
      totalEdgeDistanceMeters: totalDistance,
      boundingBox: box,
    };
  }
}
