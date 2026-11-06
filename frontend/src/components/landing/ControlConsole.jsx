import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import HeroGraph from './HeroGraph.jsx';
import { useSession } from '../../context/SessionContext.jsx';
import { useNotify } from '../../context/ToastContext.jsx';
import { validateOperatorName, LIMITS } from '../../session/validation.js';
import { formatDateTime } from '../../api/format.js';

/**
 * The "request control" surface. It looks like a gate but is not authentication: no account, no password.
 * Requesting control creates (or resumes) an anonymous workspace for saved routes and history.
 */
export default function ControlConsole({ reason }) {
  const { session, holdsControl, requestControl } = useSession();
  const notify = useNotify();
  const navigate = useNavigate();
  const nameId = useId();
  const [label, setLabel] = useState('');
  const [touched, setTouched] = useState(false);
  const [state, setState] = useState({ status: 'idle', error: null });

  const returning = Boolean(session) && !holdsControl; // released earlier: requesting control resumes that workspace
  const validation = returning || holdsControl ? { value: '' } : validateOperatorName(label);
  const labelError = touched && validation.error ? validation.error : undefined;
  const busy = state.status === 'loading';

  async function onSubmit(e) {
    e.preventDefault();
    if (holdsControl) { navigate('/app'); return; }
    setTouched(true);
    if (validation.error) return;
    setState({ status: 'loading', error: null });
    try {
      const { resumed, replaced } = await requestControl(validation.value);
      if (replaced) notify.info('Your earlier workspace was not found on the server, so a new one was started.');
      notify.success(resumed ? 'Control resumed. Your saved routes and history are back.' : 'Control granted. Your workspace is ready.');
      navigate('/app');
    } catch (err) {
      setState({ status: 'error', error: err.message });
    }
  }

  const status = busy ? { text: 'Requesting', tone: 'cyan' } : holdsControl ? { text: 'Control held', tone: 'green' } : state.status === 'error' ? { text: 'Request failed', tone: 'magenta' } : { text: 'Standby', tone: 'neutral' };
  const buttonText = holdsControl ? 'Open workspace' : returning ? 'Request control and resume' : 'Request control';

  return (
    <section id="control-console" aria-labelledby={`${nameId}-title`} className="border border-border border-t-2 border-t-primary bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="nx-label">Access</p>
          <h2 id={`${nameId}-title`} className="text-base font-semibold">Control console</h2>
        </div>
        <Badge tone={status.tone}><span role="status">{status.text}</span></Badge>
      </header>

      <div className="flex flex-col gap-5 p-4">
        <HeroGraph />

        {reason === 'control-required' && !holdsControl && (
          <p role="note" className="border border-cyan px-3 py-2 font-mono text-xs text-body">Request control to open the workspace.</p>
        )}

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {holdsControl && (
            <p className="text-sm text-body">You hold control of {session.label ? <strong className="text-ink">{session.label}</strong> : 'your workspace'}. Your saved routes and history are ready.</p>
          )}
          {returning && (
            <p className="text-sm text-body">
              Your earlier workspace{session.label ? <> <strong className="text-ink">{session.label}</strong></> : null}
              {session.createdAt ? <> (created {formatDateTime(session.createdAt)})</> : null} is waiting. Requesting control resumes it with all its data.
            </p>
          )}
          {!holdsControl && !returning && (
            <Input
              label="Operator name (optional)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={() => setTouched(true)}
              maxLength={LIMITS.operatorMax + 20}
              autoComplete="nickname"
              placeholder="e.g. Amrendra"
              hint={`Shown only to you. Up to ${LIMITS.operatorMax} characters.`}
              error={labelError}
            />
          )}

          <Button type="submit" size="lg" loading={busy} className="w-full">{buttonText}</Button>

          {state.status === 'error' && <p role="alert" className="font-mono text-xs text-secondary">{state.error}</p>}
        </form>

        <p className="border-t border-border pt-3 font-mono text-xs text-muted">
          This is not a login. NEXORA has no accounts or passwords. Requesting control creates an anonymous workspace, kept in this browser by a random key.
        </p>
      </div>
    </section>
  );
}
