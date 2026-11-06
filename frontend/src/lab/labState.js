/**
 * Visual state derived ONLY from real engine events (see backend/src/engine/events.js).
 * No algorithm logic lives here: this module just records what the engine reported.
 * State is mutated in place for speed; LabPlayer bumps a version so React re-renders.
 */

export const edgeKey = (from, to) => `${from}>${to}`;

export function createLabState() {
  return {
    algorithm: null,
    metric: null,
    source: null,
    target: null,
    visited: new Map(),     // node -> visit order
    frontier: new Map(),    // node -> latest queued priority (nodes waiting in the priority queue)
    dist: new Map(),        // node -> best known cost
    exploredEdges: new Map(), // "a>b" -> 'explored' | 'relaxed'
    current: null,
    path: [],
    pathEdgeKeys: new Set(),
    found: null,            // null until the run ends
    cost: null,
    done: false,
    queueSize: 0,
    counters: { nodesVisited: 0, edgesExplored: 0, distanceUpdates: 0, queuePushes: 0, queuePops: 0, stalePops: 0, reExpansions: 0 },
  };
}

/** Apply one event to the state (mutates and returns it). */
export function applyEvent(state, e) {
  const c = state.counters;
  switch (e.type) {
    case 'start':
      state.algorithm = e.algorithm; state.metric = e.metric; state.source = e.source; state.target = e.target;
      break;
    case 'queue_push':
      state.frontier.set(e.node, e.priority);
      state.queueSize = e.queueSize;
      c.queuePushes += 1;
      break;
    case 'queue_pop':
      state.queueSize = e.queueSize;
      c.queuePops += 1;
      if (e.stale) c.stalePops += 1;
      else state.frontier.delete(e.node);
      break;
    case 'node_visited':
      if (state.visited.has(e.node)) c.reExpansions += 1;
      state.visited.set(e.node, e.order);
      state.current = e.node;
      c.nodesVisited = state.visited.size;
      break;
    case 'edge_explored': {
      const k = edgeKey(e.from, e.to);
      if (!state.exploredEdges.has(k)) state.exploredEdges.set(k, 'explored');
      c.edgesExplored += 1;
      break;
    }
    case 'distance_updated':
      state.dist.set(e.node, e.newValue);
      state.exploredEdges.set(edgeKey(e.via, e.node), 'relaxed');
      c.distanceUpdates += 1;
      break;
    case 'destination_reached':
      state.current = e.node;
      break;
    case 'path_reconstructed':
      state.path = e.path;
      state.cost = e.cost;
      state.found = true;
      state.done = true;
      state.current = null;
      state.pathEdgeKeys = new Set(e.path.slice(1).map((n, i) => edgeKey(e.path[i], n)));
      break;
    case 'no_path':
      state.found = false;
      state.done = true;
      state.current = null;
      break;
    default:
      break;
  }
  return state;
}

/** Apply every event and return the final state (used for the static comparison view). */
export function replayAll(events) {
  const state = createLabState();
  for (const e of events) applyEvent(state, e);
  return state;
}

const fmt = (v, metric) => (metric === 'time' ? `${v.toFixed(1)} s` : `${v.toFixed(1)} m`);

/** Short human-readable description of an event for the live log. */
export function describeEvent(e, metric = 'distance') {
  switch (e.type) {
    case 'start': return `Start ${e.algorithm === 'astar' ? 'A*' : 'Dijkstra'} from ${e.source} to ${e.target}`;
    case 'queue_push': return e.reason === 'source' ? `Queue: insert source ${e.node} (priority ${fmt(e.priority, metric)})` : `Queue: insert ${e.node} (priority ${fmt(e.priority, metric)})`;
    case 'queue_pop': return e.stale ? `Queue: skip outdated entry for ${e.node}` : `Queue: extract minimum ${e.node} (priority ${fmt(e.priority, metric)})`;
    case 'node_visited': return `Visit ${e.node} (cost so far ${fmt(e.cost, metric)})${e.reExpansion ? ' [re-expanded]' : ''}`;
    case 'edge_explored': return `Explore edge ${e.from} → ${e.to} (weight ${fmt(e.weight, metric)})`;
    case 'distance_updated': return `Better cost for ${e.node}: ${e.oldValue === null ? 'first found' : `${fmt(e.oldValue, metric)} →`} ${fmt(e.newValue, metric)} via ${e.via}`;
    case 'destination_reached': return `Destination ${e.node} reached (cost ${fmt(e.cost, metric)})`;
    case 'path_reconstructed': return `Path reconstructed: ${e.path.length} nodes, cost ${fmt(e.cost, metric)}`;
    case 'no_path': return `No path: ${e.visitedCount} reachable nodes were visited`;
    default: return e.type;
  }
}
