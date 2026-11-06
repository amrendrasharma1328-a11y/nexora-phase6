import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Header from './Header.jsx';
import StatusIndicator from './StatusIndicator.jsx';
import SearchInput from '../ui/SearchInput.jsx';
import Tooltip from '../ui/Tooltip.jsx';
import Icon from '../ui/Icon.jsx';
import ReleaseControlDialog from '../session/ReleaseControlDialog.jsx';
import { NAV_ITEMS } from '../../config/navigation.js';
import { useHealth } from '../../hooks/useHealth.js';
import { useSession } from '../../context/SessionContext.jsx';

const iconButton = 'flex h-10 items-center justify-center gap-2 border border-control px-3 font-mono text-xs uppercase tracking-[0.12em] text-body hover:border-primary hover:text-primary';

/** Responsive application shell: sidebar + header + main content. */
export default function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [query, setQuery] = useState('');
  const health = useHealth();
  const { session } = useSession();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const current = NAV_ITEMS.find((i) => i.path === pathname);
  const title = current ? current.title : pathname === '/app/design-system' ? 'Design System' : 'Not Found';

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  function onSearch(value) {
    const q = value.trim();
    if (q) navigate('/app/route-planner', { state: { to: q } });
  }

  return (
    <div className="nx-scanlines min-h-screen bg-bg">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[70] focus:bg-primary focus:px-3 focus:py-2 focus:text-bg">
        Skip to content
      </a>
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="lg:pl-sidebar">
        <Header title={title} menuOpen={menuOpen} onMenuClick={() => setMenuOpen((v) => !v)}>
          <SearchInput
            label="Quick search for a destination"
            placeholder="Search destination…"
            value={query}
            onChange={setQuery}
            onSearch={onSearch}
            className="hidden w-64 md:block"
          />
          <StatusIndicator status={health.status} />
          <Tooltip content="Settings">
            <Link to="/app/settings" aria-label="Settings" className={`${iconButton} w-10 !px-0`}>
              <Icon name="settings" />
            </Link>
          </Tooltip>
          <button type="button" onClick={() => setReleaseOpen(true)} className={iconButton} aria-label={`Release control${session?.label ? ` (${session.label})` : ''}`}>
            <Icon name="power" />
            <span className="hidden xl:inline">Release control</span>
          </button>
        </Header>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl p-4 sm:p-6">
          <Outlet context={{ health }} />
        </main>
      </div>
      <ReleaseControlDialog open={releaseOpen} onClose={() => setReleaseOpen(false)} />
    </div>
  );
}
