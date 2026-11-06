import { useState } from 'react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import { saveRoute } from '../../api/client.js';
import { useNotify } from '../../context/ToastContext.jsx';
import { validateRouteName, LIMITS } from '../../session/validation.js';
import { defaultRouteName } from '../../routing/routeTypes.js';
import { formatDistance, formatDuration } from '../../api/format.js';
import { useSettings } from '../../context/SettingsContext.jsx';

/**
 * Name and save a calculated route. Mount with a new `key` per route so the form starts fresh.
 * Distance and time shown here are what gets stored; opening the route later recalculates it.
 * @param {{open: boolean, onClose: () => void, plan: {source: object, destination: object, algorithm: string}, result: object,
 *   onSaved: (record: object) => void}} props
 */
export default function SaveRouteDialog({ open, onClose, plan, result, onSaved }) {
  const notify = useNotify();
  const { settings } = useSettings();
  const [name, setName] = useState(() => defaultRouteName(plan.source, plan.destination));
  const [touched, setTouched] = useState(false);
  const [state, setState] = useState({ loading: false, error: null });

  const check = validateRouteName(name);
  const nameError = (touched || state.error) && check.error ? check.error : undefined;

  async function submit(e) {
    e.preventDefault();
    setTouched(true);
    if (check.error) return;
    setState({ loading: true, error: null });
    try {
      const record = await saveRoute({
        name: check.value,
        source: { label: plan.source.label, lat: plan.source.lat, lng: plan.source.lng },
        destination: { label: plan.destination.label, lat: plan.destination.lat, lng: plan.destination.lng },
        algorithm: plan.algorithm,
        metric: result.metric,
        distanceMeters: result.distanceMeters,
        estimatedTimeSeconds: result.estimatedTimeSeconds,
        dataSource: result.dataSource?.type,
      });
      notify.success(`Saved “${record.name}”.`);
      onSaved(record);
      onClose();
    } catch (err) {
      setState({ loading: false, error: err.message });
    }
  }

  return (
    <Modal
      open={open}
      onClose={state.loading ? () => {} : onClose}
      title="Save route"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={state.loading}>Cancel</Button>
          <Button type="submit" form="save-route-form" loading={state.loading}>Save route</Button>
        </>
      )}
    >
      <form id="save-route-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Input
          label="Route name"
          value={name}
          onChange={(e) => { setName(e.target.value); setState((s) => ({ ...s, error: null })); }}
          onBlur={() => setTouched(true)}
          maxLength={LIMITS.routeNameMax + 20}
          autoFocus
          data-autofocus
          error={nameError}
          hint={`${check.value?.length ?? name.trim().length} / ${LIMITS.routeNameMax}`}
        />
        <dl className="grid grid-cols-2 gap-3 border border-border p-3 font-mono text-xs">
          <div className="col-span-2"><dt className="nx-label">From</dt><dd className="mt-1 text-ink">{plan.source.label}</dd></div>
          <div className="col-span-2"><dt className="nx-label">To</dt><dd className="mt-1 text-ink">{plan.destination.label}</dd></div>
          <div><dt className="nx-label">Distance</dt><dd className="mt-1 text-ink">{formatDistance(result.distanceMeters, settings.units)}</dd></div>
          <div><dt className="nx-label">Estimated time</dt><dd className="mt-1 text-ink">{formatDuration(result.estimatedTimeSeconds)}</dd></div>
        </dl>
        {state.error && <p role="alert" className="font-mono text-xs text-secondary">{state.error}</p>}
      </form>
    </Modal>
  );
}
