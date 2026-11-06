import { Navigate, Routes, Route } from 'react-router-dom';
import AppShell from './components/layout/AppShell.jsx';
import RequireControl from './components/session/RequireControl.jsx';
import NotFound from './pages/NotFound.jsx';
import Landing from './pages/Landing.jsx';
import DesignSystem from './pages/DesignSystem.jsx';
import Dashboard from './pages/Dashboard.jsx';
import RoutePlanner from './pages/RoutePlanner.jsx';
import AlgorithmLab from './pages/AlgorithmLab.jsx';
import SavedRoutes from './pages/SavedRoutes.jsx';
import History from './pages/History.jsx';
import Analytics from './pages/Analytics.jsx';
import Settings from './pages/Settings.jsx';
import { LEGACY_PATHS } from './config/navigation.js';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="app" element={<RequireControl><AppShell /></RequireControl>}>
        <Route index element={<Dashboard />} />
        <Route path="route-planner" element={<RoutePlanner />} />
        <Route path="algorithm-lab" element={<AlgorithmLab />} />
        <Route path="saved-routes" element={<SavedRoutes />} />
        <Route path="history" element={<History />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
        {import.meta.env.DEV && <Route path="design-system" element={<DesignSystem />} />}
        <Route path="*" element={<NotFound />} />
      </Route>
      {/* Phase 0-5 URLs lived at the root; keep old bookmarks working. */}
      {LEGACY_PATHS.map((p) => <Route key={p} path={p} element={<Navigate to={`/app/${p}`} replace />} />)}
      <Route path="*" element={<NotFound to="/" label="Back to start" />} />
    </Routes>
  );
}
