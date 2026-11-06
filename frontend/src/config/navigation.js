/** Sidebar navigation items. The workspace lives under /app; the landing page is at /. */
export const APP_BASE = '/app';

export const NAV_ITEMS = [
  { path: '/app', label: 'Dashboard', icon: 'dashboard', title: 'Dashboard' },
  { path: '/app/route-planner', label: 'Route Planner', icon: 'route', title: 'Route Planner' },
  { path: '/app/algorithm-lab', label: 'Algorithm Lab', icon: 'lab', title: 'Algorithm Lab' },
  { path: '/app/saved-routes', label: 'Saved Routes', icon: 'bookmark', title: 'Saved Routes' },
  { path: '/app/history', label: 'Route History', icon: 'history', title: 'Route History' },
  { path: '/app/analytics', label: 'Analytics', icon: 'chart', title: 'Analytics' },
  { path: '/app/settings', label: 'Settings', icon: 'settings', title: 'Settings' },
];

/** Pre-Phase 6 URLs (before the workspace moved under /app) keep working. */
export const LEGACY_PATHS = ['route-planner', 'algorithm-lab', 'saved-routes', 'analytics', 'settings'];
