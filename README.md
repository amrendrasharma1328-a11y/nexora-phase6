# NEXORA – Intelligent Route Planning System

Pure JavaScript project (no TypeScript, no Java).

- Frontend: React + Vite, Tailwind CSS (`frontend/`)
- Backend: Node.js + Express, ES modules (`backend/`)
- DSA engine (pure JS): `backend/src/engine/` – Graph, custom MinHeap, Dijkstra, A*, Haversine
- Tests: Vitest + Supertest

## Status
- Phase 0: foundation and design system
- Phase 1: dashboard (demo data clearly labelled; live backend status)
- Phase 3: backend + DSA engine (Graph, MinHeap, Dijkstra, A*)
- Phase 4: OpenStreetMap road network, place search, snapping, Leaflet route planner (see `docs/OSM.md`)
- Without cached OSM data the backend uses a **synthetic sample graph** and says so in the UI
- Phase 5: Algorithm Lab (real engine events replayed in the UI; see `docs/ALGORITHM_LAB.md`)
- Phase 6: landing page + "request control" (anonymous workspace, not authentication), saved routes, route history, analytics, settings (see `docs/PHASE6.md`)
- Not built yet: Phase 7 (QA)

## Run
Backend (port 5000):
```bash
cd backend && npm install && npm run dev
npm run fetch-osm # one-time: download + cache real roads (needs internet, see docs/OSM.md)
npm test          # Vitest + Supertest
npm run bench     # algorithm benchmark on a generated grid
```
Frontend (port 5173, proxies /api to backend):
```bash
cd frontend && npm install && npm run dev
npm run build
npm test          # Vitest (lab playback + state logic)
```
API reference: `docs/API.md`
