/**
 * Surface container with a thin green signal rail on top.
 * @param {{title?: string, meta?: string, actions?: import('react').ReactNode, as?: any,
 *   className?: string, children?: import('react').ReactNode}} props
 */
export default function Card({ title, meta, actions, as: Tag = 'section', className = '', children }) {
  return (
    <Tag className={`border border-border border-t-2 border-t-primary bg-surface ${className}`}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            {meta && <p className="nx-label mb-1">{meta}</p>}
            {title && <h3 className="text-base font-semibold">{title}</h3>}
          </div>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </Tag>
  );
}
