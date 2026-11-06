import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';
import RadioGroup from '../ui/RadioGroup.jsx';
import { useSession } from '../../context/SessionContext.jsx';
import { useNotify } from '../../context/ToastContext.jsx';

/**
 * "Release control": leave the workspace, keeping or erasing its data.
 * Keeping data is the default; erasing is permanent and asks for an explicit choice.
 */
export default function ReleaseControlDialog({ open, onClose }) {
  const { release } = useSession();
  const notify = useNotify();
  const navigate = useNavigate();
  const [choice, setChoice] = useState('keep');
  const [state, setState] = useState({ loading: false, error: null });

  function close() {
    if (state.loading) return;
    setState({ loading: false, error: null });
    setChoice('keep');
    onClose();
  }

  async function confirm() {
    setState({ loading: true, error: null });
    try {
      await release({ erase: choice === 'erase' });
      notify.success(choice === 'erase' ? 'Control released and workspace data erased.' : 'Control released. Request control again to resume your workspace.');
      setState({ loading: false, error: null });
      setChoice('keep');
      onClose();
      navigate('/');
    } catch (err) {
      setState({ loading: false, error: err.message });
    }
  }

  return (
    <ConfirmDialog
      open={open}
      title="Release control?"
      description="You will return to the start page."
      confirmLabel={choice === 'erase' ? 'Release and erase' : 'Release control'}
      tone={choice === 'erase' ? 'danger' : 'primary'}
      loading={state.loading}
      error={state.error}
      onConfirm={confirm}
      onCancel={close}
    >
      <div className="mt-4">
        <RadioGroup
          legend="Your saved routes and history"
          value={choice}
          onChange={setChoice}
          columns={1}
          options={[
            { value: 'keep', label: 'Keep my data', hint: 'Requesting control again resumes this workspace.' },
            { value: 'erase', label: 'Erase my data permanently', hint: 'Deletes saved routes and history from the server. This cannot be undone.' },
          ]}
        />
      </div>
    </ConfirmDialog>
  );
}
