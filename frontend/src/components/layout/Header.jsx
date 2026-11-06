import Icon from '../ui/Icon.jsx';

/**
 * Top header. Menu button is only visible below lg.
 * @param {{title: string, onMenuClick: () => void, menuOpen: boolean, children?: import('react').ReactNode}} props
 */
export default function Header({ title, onMenuClick, menuOpen, children }) {
  return (
    <header className="sticky top-0 z-20 flex h-header items-center gap-3 border-b border-border bg-bg/95 px-4 sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Toggle navigation menu"
        aria-expanded={menuOpen}
        aria-controls="primary-sidebar"
        className="flex h-10 w-10 items-center justify-center border border-control text-body hover:border-primary hover:text-primary lg:hidden"
      >
        <Icon name="menu" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="nx-label">Section</p>
        <h1 className="truncate text-lg font-semibold">{title}</h1>
      </div>
      {children}
    </header>
  );
}
