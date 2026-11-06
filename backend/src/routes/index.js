import { Router } from 'express';

/**
 * @param {ReturnType<import('../controllers/routeController.js').createRouteController>} c
 * @param {ReturnType<import('../controllers/geocodingController.js').createGeocodingController>} geo
 * @param {ReturnType<import('../controllers/labController.js').createLabController>} lab
 * @param {{controller: ReturnType<import('../controllers/workspaceController.js').createWorkspaceController>,
 *   workspace: ReturnType<import('../middleware/workspace.js').createWorkspaceMiddleware>,
 *   controlLimiter: import('express').RequestHandler}} [ws] Phase 6: control sessions, saved routes, history, analytics
 */
export function createRouter(c, geo, lab, ws = null) {
  const router = Router();
  const optional = ws ? ws.workspace.optional : (_req, _res, next) => next();

  router.get('/health', c.health);
  router.get('/graph/statistics', c.statistics);
  router.get('/search', (req, res, next) => geo.search(req, res).catch(next));
  // Routing endpoints record history only when a valid control session is supplied.
  router.post('/routes/shortest', optional, c.shortest);
  router.post('/routes/fastest', optional, c.fastest);
  router.post('/routes/astar', optional, c.astar);
  router.get('/lab/graph', lab.graph);
  router.post('/lab/run', lab.run);
  router.post('/lab/compare', lab.compare);

  if (ws) {
    const { controller: w, workspace, controlLimiter } = ws;
    router.post('/session', controlLimiter, w.requestControl);
    router.get('/session', workspace.require, w.session);
    router.delete('/session', workspace.require, w.eraseSession);

    router.get('/saved-routes', workspace.require, w.listSaved);
    router.post('/saved-routes', workspace.require, w.createSaved);
    router.get('/saved-routes/:id', workspace.require, w.getSaved);
    router.delete('/saved-routes/:id', workspace.require, w.deleteSaved);

    router.get('/history', workspace.require, w.listHistory);
    router.delete('/history', workspace.require, w.clearHistory);

    router.get('/analytics', workspace.require, w.analytics);
  }
  return router;
}
