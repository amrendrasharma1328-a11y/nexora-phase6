/**
 * Structured execution events emitted by the routing algorithms (opt-in via the `onEvent` option).
 * The Algorithm Lab replays these REAL events; nothing is simulated.
 *
 * Event types and payloads (every event also has a monotonically increasing `seq`):
 *  start               { algorithm, metric, source, target }
 *  queue_push          { node, priority, queueSize, reason: 'source' | 'improved' }   priority queue updated (insert)
 *  queue_pop           { node, priority, queueSize, stale }                           priority queue updated (extractMin)
 *  node_visited        { node, cost, order, [h, f, reExpansion] }                     node settled / expanded
 *  edge_explored       { from, to, weight }
 *  distance_updated    { node, via, oldValue | null, newValue, [h, f] }               better cost found for `node`
 *  destination_reached { node, cost }
 *  path_reconstructed  { path, cost, edgeCount }
 *  no_path             { visitedCount }
 */
export const EVENT_TYPES = Object.freeze([
  'start', 'queue_push', 'queue_pop', 'node_visited', 'edge_explored',
  'distance_updated', 'destination_reached', 'path_reconstructed', 'no_path',
]);

/**
 * Wrap a user callback so every event gets a sequence number.
 * @param {((event: object) => void)|null|undefined} onEvent
 * @returns {((event: object) => void)|null} null when no callback (so callers skip building event objects)
 */
export function makeEmitter(onEvent) {
  if (typeof onEvent !== 'function') return null;
  let seq = 0;
  return (event) => onEvent({ seq: seq++, ...event });
}
