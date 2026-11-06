# NEXORA API (Phases 3-4)

Base URL (dev): `http://localhost:5000/api`

> **Data source:** every route response carries `dataSource`: `type: "osm"` (cached OpenStreetMap roads, see `docs/OSM.md`)
> or `type: "sample"` (synthetic grid used when no OSM cache exists). `estimatedTimeSeconds` comes from speed tags /
> assumed speeds, **not live traffic**.

Errors: `{ "error": { "code": "...", "message": "...", "details"?: {} } }`

| Status | Meaning |
|---|---|
| 200 | Success. An unreachable destination is also 200 with `found: false`, `reason: "NO_PATH"` |
| 400 | `INVALID_REQUEST`, `INVALID_METRIC`, `INVALID_JSON`, `INVALID_QUERY` |
| 404 | `INVALID_VERTEX` (unknown source/destination), `NOT_FOUND` (unknown API path) |
| 422 | `NO_NEARBY_ROAD` (coordinate more than 500 m from any intersection), `MISSING_COORDINATES`, `MISSING_WEIGHT` |
| 502 / 503 | `GEOCODER_UNAVAILABLE`, `GEOCODER_ERROR` / `GEOCODER_RATE_LIMITED` |
| 500 | `INTERNAL_ERROR` |

## GET /api/health
`{ "status": "ok", "service": "nexora-backend", "uptimeSeconds": 12, "timestamp": "..." }`

## GET /api/graph/statistics
Returns `graph` (vertexCount, edgeCount, oneWayEdgeCount, edgesWithTime, isolatedVertexCount, averageOutDegree,
totalEdgeDistanceMeters, boundingBox), `heuristicScales`, and `dataSource`.

## GET /api/search?q=<text>
Place search (Nominatim, limited to the configured region, cached, rate-limited to 1 request/s upstream).
Call it on explicit submit only (no autocomplete). Returns `{ query, results: [{displayName, lat, lng, category, type, osmType, osmId}], attribution }`.

## POST /api/routes/shortest
Dijkstra, minimises **distance** (meters).
## POST /api/routes/fastest
Dijkstra, minimises estimated **time** (seconds, assumed speeds).
## POST /api/routes/astar
A*, `metric` optional: `"distance"` (default) or `"time"`.

Body (all three). `source` / `destination` are a vertex id **or** `{ "lat": .., "lng": .. }` (snapped to the nearest road intersection within 500 m):
```json
{ "source": { "lat": 26.8501, "lng": 80.9501 }, "destination": "N5-5", "includeDetails": false }
```
When a coordinate was used the response includes `snapped: { source, destination }` with `{requested, vertexId, distanceMeters}`.
`routeGeometry` is `[[lat, lng], ...]` following the real road shape (OSM) or the vertex coordinates (sample graph).
`includeDetails: true` adds `visitedNodes` and `exploredEdges` arrays.

Response (abridged):
```json
{
  "found": true, "algorithm": "dijkstra", "metric": "distance",
  "source": "N0-0", "destination": "N5-5", "reason": null,
  "cost": { "value": 1954.0, "unit": "meters" },
  "distanceMeters": 1954.0, "estimatedTimeSeconds": 137.7,
  "path": ["N0-0", "N3-3", "..."],
  "coordinates": [{ "id": "N0-0", "lat": 26.85, "lng": 80.95 }],
  "roads": [{ "from": "N0-0", "to": "N3-3", "name": "express-link", "roadType": "express", "distance": 790.1 }],
  "executionTimeMs": 0.4,
  "stats": { "nodesVisited": 36, "edgesExplored": 108, "heapInserts": 40, "heapExtractions": 40, "pathNodes": 6, "pathEdges": 5 },
  "dataSource": { "type": "sample", "description": "..." }
}
```
(numbers above are illustrative of the shape; real values are computed per request.)
A* also returns `heuristic` ({name, unit, scale}).

## Algorithm Lab (Phase 5)
Synthetic grid (3x3 to 25x25, ids `N<row>-<col>`), labelled `dataSource.type: "sample"`.

- `GET /api/lab/graph?rows=12&cols=12` returns `{vertices: [{id, lat, lng}], edges: [{from, to, oneWay, roadType, distance}], statistics}`.
- `POST /api/lab/run` body `{ rows, cols, source, destination, algorithm: "dijkstra"|"astar", metric?: "distance"|"time" }`
  returns the result plus `events` (see `docs/ALGORITHM_LAB.md`), `metrics` (nodesVisited, edgesExplored, distanceUpdates,
  heapInserts, heapExtractions, priorityQueueOperations, pathNodes, pathEdges, executionTimeMs) and `timingNote`.
- `POST /api/lab/compare` same body without `algorithm`; returns `runs: {dijkstra, astar}` and `comparison: {costsMatch, nodesSavedByAStar, summary[]}`.

Errors: 400 invalid request (size outside 3..25, bad algorithm/metric, missing ids), 404 `INVALID_VERTEX`.

## Control sessions, saved routes, history, analytics (Phase 6)
NEXORA has no accounts. `POST /api/session` creates an anonymous workspace and returns its key; send it as the
`X-Nexora-Workspace` header on every later call. The key is a bearer token (128 random bits), NOT authentication.

Errors use `{ error: { code, message, details? } }`. Missing header: 401 `CONTROL_REQUIRED`; unknown key: 401 `CONTROL_INVALID`.

| Method and path | Purpose |
| --- | --- |
| `POST /api/session` body `{label?}` (letters, numbers, space . _ ' -, max 40) | 201 `{workspaceId, label, createdAt, lastSeenAt}`. Rate limited (30 per 10 min per IP): 429 `RATE_LIMITED` + `Retry-After`; 503 `CAPACITY` |
| `GET /api/session` | Validates the key; returns `counts: {savedRoutes, history}` |
| `DELETE /api/session` | Erases the workspace and all its data |
| `GET /api/saved-routes` | `{items (newest first), total, limit: 200}` |
| `POST /api/saved-routes` | Body `{name (1-80), source:{label,lat,lng}, destination:{...}, algorithm, metric, distanceMeters, estimatedTimeSeconds|null, dataSource?}`. 201 record; 400 `INVALID_REQUEST`; 409 `DUPLICATE_ROUTE` (same places + algorithm + metric; `details.existingId`); 422 `LIMIT_REACHED` |
| `GET /api/saved-routes/:id` / `DELETE` | 200, or 404 `NOT_FOUND` |
| `GET /api/history?limit=25&offset=0&algorithm=` | Newest first, `{items, total, limit, offset, retention: 1000}` |
| `DELETE /api/history` | `{cleared: true, removed}`; saved routes are untouched |
| `GET /api/analytics?range=7d\|30d\|90d\|all&tz=330` | See below. `tz` = viewer's minutes east of UTC (days are bucketed in local time) |

History is recorded automatically by `POST /api/routes/shortest|fastest|astar` when a valid `X-Nexora-Workspace`
header is present. Those endpoints also accept optional `labels: {source?, destination?}` (place names, max 200).
Without a (valid) header routing works exactly as before and nothing is recorded. Algorithm Lab runs are never recorded.

History record: `{id, at, source:{label,lat,lng}, destination, algorithm, metric, found, distanceMeters, estimatedTimeSeconds, executionTimeMs, nodesVisited, dataSource}`.

Analytics response: `range`, `totals {routesCalculated, successful, noPath, savedRoutes}`, `averages {distanceMeters, estimatedTimeSeconds, executionTimeMs}`
(`null` when there is no data), `algorithms[] {algorithm, count, share, avgExecutionTimeMs, avgNodesVisited, avgDistanceMeters}`,
`routeTypes[]`, `topDestinations[]` (max 5), `trend {days, points[] {date, count, avgDistanceMeters}}` (`all` shows the latest 90 days).
