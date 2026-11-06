import Icon from './Icon.jsx';
import Button from './Button.jsx';

/** @param {{title?: string, message?: string, onRetry?: () => void}} props */
export default function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 border border-secondary px-6 py-12 text-center">
      <Icon name="alert" size={28} className="text-secondary" />
      <h3 className="text-lg font-semibold">{title}</h3>
      {message && <p className="max-w-md font-mono text-sm text-muted">{message}</p>}
      {onRetry && <Button variant="danger" onClick={onRetry}>Retry</Button>}
    </div>
  );
}
