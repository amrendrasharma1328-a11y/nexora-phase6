# Phase 4: OpenStreetMap road network

## Data sources and licensing
- **Roads:** OpenStreetMap via the **Overpass API** (`OVERPASS_URL`, default `https://overpass-api.de/api/interpreter`).
  Data © OpenStreetMap contributors, **ODbL 1.0**. The UI shows the attribution; keep it if you publish the app.
- **Place search:** **Nominatim** (`NOMINATIM_URL`, default the public `nominatim.openstreetmap.org`).
- **Map tiles:** `tile.openstreetmap.org` (fine for development/demo; use a tile provider for production traffic).
- Set `OVERPASS_USER_AGENT` and `NOMINATIM_USER_AGENT` to something that identifies you (app + contact email).

### Usage-policy behaviour built in
| Concern | What the code does |
|---|---|
| Overpass | ONE request, response cached on disk (`backend/data/cache/<region>.overpass.json`); refetch only with `--refresh`; identifying User-Agent; clear errors for 429/timeouts |
| Nominatim | max 1 request/second (serialised queue), identifying User-Agent, in-memory cache (10 min), **no search-as-you-type** (frontend searches on submit only), results bounded to the region |

## Configurable region
Default demo region is Lucknow (`backend/src/config/regions.js`). Nothing else is hardcoded to it.
```bash
NEXORA_REGION=lucknow                      # id from regions.js
NEXORA_BBOX="12.90,77.50,13.00,77.70"      # custom box: south,west,north,east
NEXORA_REGION_NAME="Bengaluru"             # label for a custom box
```
Keep boxes modest: a whole city can be a very large download.

## Quick start
```bash
cd backend
npm install
npm run fetch-osm      # one-time download + cache (needs internet)
npm run dev            # loads the cached roads; falls back to the SAMPLE graph (clearly labelled) if there is no cache
```
`NEXORA_GRAPH=osm` makes startup fail instead of falling back; `NEXORA_GRAPH=sample` forces the synthetic grid.

## Graph construction (`src/osm/buildGraph.js`)
1. Keep only ways with a drivable `highway` class (motorway … residential, living_street, service + link roads).
2. Drop ways closed to cars: `access` / `vehicle` / `motor_vehicle` = `no` or `private` (most specific tag wins),
   `area=yes`, parking aisles / driveways.
3. **Vertices = real intersections only**: OSM nodes shared by two or more road occurrences, plus way endpoints.
   Roads that cross or run close together **without a shared node are not connected** (bridges, tunnels, unconnected lines).
4. **Edges = road segments** between vertices. The **distance is the sum of Haversine lengths over every shape point**
   (road geometry), not the straight line. The geometry is kept on the edge for map drawing.
5. **Direction:** `oneway=yes/true/1` forward, `oneway=-1/reverse` backward, roundabouts and motorways implicitly one-way
   unless `oneway=no`; everything else two-way. One-way roads become a single directed edge.
6. **Estimated time** = distance / (`maxspeed` tag if parseable, otherwise an **assumed** class speed).
   This is *not* traffic-aware and is *not* measured.
7. **Pruning:** keeps the largest strongly connected component so every vertex can reach every other
   (removes one-way dead-end pockets and isolated fragments). Counts before/after are reported in `dataSource.buildStats`.

## Location snapping
Coordinates (from the map or from a geocoder result) are snapped to the nearest **intersection vertex** within 500 m using a
grid spatial index (`src/osm/spatialIndex.js`). The API reports how far each point was moved (`snapped`).

## Route accuracy limitations (be honest in demos)
- **Not live traffic.** Time is an estimate from speed limits/assumed speeds; no congestion, signals, or time-of-day effects.
- **Turn restrictions are not modelled** (OSM `restriction` relations), nor time-based or conditional restrictions
  (`oneway:conditional`, `access:conditional`), tolls, lanes, or vehicle-specific rules. Routes are for a generic car.
- **Snapping is to intersections**, so start/end can be off by up to one segment length (reported in `snapped`).
- Quality depends on OSM completeness in the region; missing or wrong tags give missing or wrong roads.
- Default assumed speeds are generic guesses, not Indian-city measurements.
- Large regions use a lot of memory and startup time (graph is built in memory on each start).
