# Phase 6: Landing page, control sessions, saved routes, history, analytics, settings

## "Request control" is not authentication
There are no user accounts. Requesting control creates an **anonymous workspace**:
- the server stores one JSON file per workspace (`backend/data/workspaces/<id>.json`), written atomically;
- the workspace key (`ws_` + 32 hex chars) is kept in this browser's localStorage and sent as `X-Nexora-Workspace`;
- anyone who has the key can open that workspace, and there is no password recovery. Do not store sensitive data in it.

Release control: keep data (requesting control again resumes the workspace) or erase it permanently.
If localStorage is blocked the session works for the current tab only.

## Where data lives
| Data | Location |
| --- | --- |
| Saved routes, route history | Backend, per workspace (file store). `NEXORA_STORE=memory` disables persistence; `NEXORA_DATA_DIR` moves the folder |
| Control session key | Browser localStorage (`nexora.session.v1`) |
| Settings (theme, motion, map, routing defaults, units) | Browser localStorage (`nexora.settings.v1`), per device |

No database existed in Phase 5, so none was invented: a small file store (pure Node, no native modules) was added behind
`backend/src/store/workspaceStore.js`. Swapping it for SQLite/Mongo later only touches that file.

## Behaviour notes
- Saved routes keep places, algorithm, route type and the distance/time at save time, not geometry. **Opening** one recalculates it on the current road graph.
- Route history is recorded server-side by the routing endpoints (so execution time and node counts are real). Limits: 200 saved routes, 1000 history entries per workspace.
- Analytics are computed only from stored history. "Preview with demo data" is opt-in, labelled DEMO, and never mixed with real numbers.
- Settings apply immediately: theme (dark / light / high contrast / system), motion (system / reduce / full; reduced motion makes the Algorithm Lab jump to the finished run), map style, default zoom, fit-route, default algorithm and route type, km or miles (everywhere distances appear).

## Run and test
```
cd backend && npm install && npm test && npm start
cd frontend && npm install && npm test && npm run dev
```
