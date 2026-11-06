import Icon from './Icon.jsx';

/** @param {{title: string, description?: string, action?: import('react').ReactNode, icon?: string}} props */
export default function EmptyState({ title, description, action, icon = 'inbox' }) {
  return (
    <div className="flex flex-col items-center gap-3 border border-dashed border-border px-6 py-12 text-center">
      <Icon name={icon} size={28} className="text-control" />
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}
