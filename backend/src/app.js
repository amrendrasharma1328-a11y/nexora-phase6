import express from 'express';
import cors from 'cors';
import { createRouter } from './routes/index.js';
import { createRouteController } from './controllers/routeController.js';
import { createGeocodingController } from './controllers/geocodingController.js';
import { createLabController } from './controllers/labController.js';
import { createWorkspaceController } from './controllers/workspaceController.js';
import { createLabService } from './services/labService.js';
import { createWorkspaceService } from './services/workspaceService.js';
import { createSavedRoutesService } from './services/savedRoutesService.js';
import { createHistoryService } from './services/historyService.js';
import { createRouteRecorder } from './services/routeRecorder.js';
import { createWorkspaceStore } from './store/workspaceStore.js';
import { createWorkspaceMiddleware } from './middleware/workspace.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import { createGeocoder } from './osm/geocoder.js';
import { createSampleGraph, SAMPLE_DATA_SOURCE } from './data/sampleGraph.js';

/**
 * Create the Express application. Graph, geocoder and workspace store are injectable (tests, other regions).
 * The default store is in-memory; server.js passes a file-backed store so data survives restarts.
 * @param {{graph?: import('./engine/Graph.js').Graph, dataSource?: object, region?: {bbox: object}|null, geocoder?: {search: Function},
 *   store?: ReturnType<typeof createWorkspaceStore>, controlRateLimit?: {limit: number, windowMs: number}, now?: () => number}} [options]
 */
export function createApp({
  graph = createSampleGraph(),
  dataSource = SAMPLE_DATA_SOURCE,
  region = null,
  geocoder = createGeocoder({ bbox: region?.bbox ?? null }),
  store = createWorkspaceStore(),
  controlRateLimit = { limit: 30, windowMs: 10 * 60 * 1000 },
  now = Date.now,
} = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const clock = () => new Date(now());
  const workspaces = createWorkspaceService({ store, now: clock });
  const savedRoutes = createSavedRoutesService({ store, now: clock });
  const history = createHistoryService({ store, now: clock });
  const recordRoute = createRouteRecorder({ graph, history });

  app.use('/api', createRouter(
    createRouteController({ graph, dataSource, onRoute: recordRoute }),
    createGeocodingController({ geocoder }),
    createLabController({ lab: createLabService() }),
    {
      controller: createWorkspaceController({ workspaces, savedRoutes, history, now }),
      workspace: createWorkspaceMiddleware({ store }),
      controlLimiter: createRateLimiter(controlRateLimit),
    },
  ));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Malformed JSON body' } });
    }
    console.error(err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  });

  return app;
}
