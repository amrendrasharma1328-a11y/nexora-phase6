import { useId } from 'react';
import Icon from './Icon.jsx';

/**
 * Search field. Calls onSearch(value) on Enter; onChange is controlled by parent.
 * @param {{value: string, onChange: (v: string) => void, onSearch?: (v: string) => void,
 *   label?: string, placeholder?: string, className?: string}} props
 */
export default function SearchInput({ value, onChange, onSearch, label = 'Search', placeholder = 'Search…', className = '' }) {
  const id = useId();
  return (
    <form
      role="search"
      className={`relative ${className}`}
      onSubmit={(e) => { e.preventDefault(); onSearch?.(value); }}
    >
      <label htmlFor={id} className="sr-only">{label}</label>
      <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-control" />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full border border-control bg-bg pl-9 pr-9 font-mono text-sm text-ink placeholder:text-muted/60 hover:border-primary"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-muted hover:text-primary"
        >
          <Icon name="close" size={14} />
        </button>
      )}
    </form>
  );
}
