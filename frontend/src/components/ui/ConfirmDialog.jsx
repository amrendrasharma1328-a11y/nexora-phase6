import Modal from './Modal.jsx';
import Button from './Button.jsx';

/**
 * Confirmation before a destructive or hard-to-undo action. Focus starts on Cancel (the safe choice);
 * Escape and the backdrop cancel. While `loading`, both buttons are locked so the action cannot be repeated.
 * @param {{open: boolean, title: string, description?: import('react').ReactNode, confirmLabel?: string,
 *   cancelLabel?: string, tone?: 'danger'|'primary', loading?: boolean, error?: string|null,
 *   onConfirm: () => void, onCancel: () => void, children?: import('react').ReactNode}} props
 */
export default function ConfirmDialog({ open, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'danger', loading = false, error = null, onConfirm, onCancel, children }) {
  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onCancel}
      title={title}
      footer={(
        <>
          <Button variant="ghost" onClick={onCancel} disabled={loading} data-autofocus>{cancelLabel}</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      )}
    >
      {description && <p className="text-body">{description}</p>}
      {children}
      {error && <p role="alert" className="mt-3 font-mono text-xs text-secondary">{error}</p>}
    </Modal>
  );
}
