/**
 * Turns a finished routing response into a history record.
 * Kept separate from the controller so routing stays unaware of storage.
 * @param {{graph: import('../engine/Graph.js').Graph, history: {record: Function}}} deps
 */
export function createRouteRecorder({ graph, history }) {
  function place(input, label, fallbackLabel) {
    if (input !== null && typeof input === 'object') return { label: label ?? `Point ${input.lat.toFixed(5)}, ${input.lng.toFixed(5)}`, lat: input.lat, lng: input.lng };
    let v = null;
    try { v = graph.getVertex(input); } catch { /* unknown ids are rejected before recording */ }
    return { label: label ?? fallbackLabel, lat: v?.lat ?? null, lng: v?.lng ?? null };
  }

  return async function record({ workspaceId, request, labels = {}, payload }) {
    await history.record(workspaceId, {
      source: place(request.source, labels.source, `Vertex ${request.source}`),
      destination: place(request.destination, labels.destination, `Vertex ${request.destination}`),
      algorithm: payload.algorithm,
      metric: payload.metric,
      found: payload.found,
      distanceMeters: payload.distanceMeters,
      estimatedTimeSeconds: payload.estimatedTimeSeconds,
      executionTimeMs: payload.executionTimeMs,
      nodesVisited: payload.stats?.nodesVisited ?? null,
      dataSource: payload.dataSource?.type ?? null,
    });
  };
}
