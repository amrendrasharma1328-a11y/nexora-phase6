# Phase 5: Algorithm Lab

## Event architecture
```
engine (backend/src/engine)         service/controller              frontend (src/lab + components/lab)
dijkstra.js / astar.js  --onEvent--> labService.runTraced  --JSON--> LabPlayer (timing, pause, step)
   emit structured events            records events + measures        applyEvent -> labState -> GraphCanvas
```
- **One implementation of each algorithm.** `dijkstra()` and `aStar()` accept an optional `onEvent` callback. Routing endpoints
  call them without it (no overhead); the lab calls the same functions with a recorder. React contains no algorithm logic.
- **Algorithm execution and animation are separate.** The algorithm runs to completion on the server and its events are
  returned as an array. `LabPlayer` (plain JS, no React) replays that array; pause/resume/step only move a cursor.
- Events carry a `seq` number. Types (see `backend/src/engine/events.js`):

| Event | Meaning |
|---|---|
| `start` | run begins |
| `queue_push` | priority queue insert (`reason`: `source` or `improved`) |
| `queue_pop` | priority queue extract-min (`stale: true` for outdated entries) |
| `node_visited` | node settled/expanded (A* adds `h`, `f`, `reExpansion`) |
| `edge_explored` | an outgoing edge was examined |
| `distance_updated` | a cheaper cost was found (`oldValue` -> `newValue`, `via`) |
| `destination_reached` | the target was extracted from the queue |
| `path_reconstructed` | final path and cost |
| `no_path` | queue exhausted without reaching the target |

## Playback
- A **step** = one expansion: it starts at each non-stale `queue_pop` and covers the following visit, edge explorations,
  cost updates and queue inserts. **Step Forward** applies one step; **Start/Resume** apply steps on a timer
  (base 300 ms divided by the speed multiplier 0.5x to 10x).
- Start restarts from the beginning; Pause stops the timer; Resume continues from the cursor; Reset returns to the initial
  state; changing speed reschedules the running timer.

## Visual language
Electric green = active exploration (visited nodes, explored edges), cyan = supporting information (frontier nodes in the
queue, edges where a better cost was found), magenta (sparingly) = start/destination and the final path.
Squares for nodes; arrows mark one-way roads.

## Metrics
Nodes visited, edges explored, priority-queue operations (inserts + extractions), queue size, distance updates, path cost,
path length (live, from replayed events) and execution time.
**Execution time is measured on the server as the median of 7 untraced runs** (so event recording does not inflate it) and
depends on hardware, graph size and runtime conditions. On small graphs it is tiny and noisy; node counts are the more reliable
way to compare search behaviour.

## Comparison
`POST /api/lab/compare` runs both algorithms on the same graph and pair. The summary text is generated from the real numbers
(same optimal cost, nodes saved by A*, and so on). Both final search states are drawn side by side.

## Scope and limits
- The lab uses a **synthetic grid** (3x3 to 25x25), not the OSM network, so the search is readable. It is labelled in the UI.
- A* on this grid shows fewer visited nodes because its straight-line heuristic fits a grid well; results on other graphs differ.
- Playback itself is user-triggered, there are no decorative animations; node highlights are static colour/outline changes.
