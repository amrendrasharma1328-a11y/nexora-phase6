import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import { NAV_ITEMS } from '../../config/navigation.js';

/**
 * Sidebar navigation. Fixed on lg+, slide-in drawer below lg.
 * @param {{open: boolean, onClose: () => void}} props
 */
export default function Sidebar({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-bg/80 lg:hidden" onClick={onClose} aria-hidden="true" />}
      <aside
        id="primary-sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-sidebar flex-col border-r border-border bg-surface transition-transform duration-base lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-header items-center gap-3 border-b border-border px-5">
          <span className="h-6 w-1.5 bg-primary" aria-hidden="true" />
          <div>
            <p className="text-lg font-semibold leading-none tracking-wide text-ink">NEXORA</p>
            <p className="nx-label mt-1">Route Intelligence</p>
          </div>
        </div>
        <nav aria-label="Primary" className="flex-1 overflow-y-auto py-4">
          <ul className="flex flex-col">
            {NAV_ITEMS.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/app'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 border-l-2 px-5 py-3 font-mono text-xs uppercase tracking-[0.12em] transition-colors duration-fast ${
                      isActive ? 'border-primary bg-primary/10 text-primary' : 'border-transparent text-body hover:bg-primary/5 hover:text-ink'
                    }`
                  }
                >
                  <Icon name={item.icon} />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <p className="border-t border-border px-5 py-3 nx-label">v0.6.0 · Phase 6</p>
      </aside>
    </>
  );
}
