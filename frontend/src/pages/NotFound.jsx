import { Link } from 'react-router-dom';
import EmptyState from '../components/ui/EmptyState.jsx';

/** @param {{to?: string, label?: string}} props where the "back" link goes */
export default function NotFound({ to = '/app', label = 'Back to dashboard' }) {
  return (
    <EmptyState
      icon="alert"
      title="Page not found"
      description="The page you requested does not exist."
      action={<Link to={to} className="border border-control px-4 py-2 font-mono text-xs uppercase tracking-[0.12em] text-primary hover:border-primary">{label}</Link>}
    />
  );
}
