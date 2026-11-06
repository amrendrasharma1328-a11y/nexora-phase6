import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import RadioGroup from '../components/ui/RadioGroup.jsx';
import Select from '../components/ui/Select.jsx';
import Toggle from '../components/ui/Toggle.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import ReleaseControlDialog from '../components/session/ReleaseControlDialog.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useSession } from '../context/SessionContext.jsx';
import { useNotify } from '../context/ToastContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { clearHistory, getSession } from '../api/client.js';
import { formatDateTime, formatDistance } from '../api/format.js';

const ZOOMS = [
  { value: 11, label: '11 (whole city)' }, { value: 12, label: '12' }, { value: 13, label: '13 (default)' },
  { value: 14, label: '14' }, { value: 15, label: '15' }, { value: 16, label: '16 (streets)' },
];

/** Settings apply immediately and are stored in this browser (per device). */
export default function Settings() {
  const { settings, update, reset, persisted, resolved } = useSettings();
  const { session, release } = useSession();
  const navigate = useNavigate();
  const notify = useNotify();
  const info = useResource(() => getSession());
  const [dialog, setDialog] = useState(null); // 'reset' | 'clear' | 'erase' | 'release'
  const [busy, setBusy] = useState({ loading: false, error: null });

  const open = (name) => { setBusy({ loading: false, error: null }); setDialog(name); };
  const close = () => setDialog(null);

  async function run(task, successMessage, after) {
    setBusy({ loading: true, error: null });
    try {
      await task();
      notify.success(successMessage);
      setDialog(null);
      setBusy({ loading: false, error: null });
      after?.();
    } catch (err) {
      setBusy({ loading: false, error: err.message });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {!persisted && (
        <p role="alert" className="border border-secondary px-3 py-2 font-mono text-xs text-body">
          This browser is blocking local storage, so settings apply now but will be forgotten when you close the tab.
        </p>
      )}
      <p className="font-mono text-xs text-muted" role="status">Changes apply immediately and are saved on this device.</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card meta="Look" title="Appearance">
          <div className="flex flex-col gap-5">
            <RadioGroup
              legend="Theme"
              value={settings.theme}
              onChange={(theme) => update({ theme })}
              options={[
                { value: 'system', label: 'Match system', hint: `Currently ${resolved.theme}` },
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
                { value: 'contrast', label: 'High contrast', hint: 'Black and white, strongest edges' },
              ]}
            />
            <Toggle label="Scanline overlay" description="Faint static lines over the interface. Off in high contrast." checked={settings.scanlines} onChange={(scanlines) => update({ scanlines })} />
          </div>
        </Card>

        <Card meta="Movement" title="Motion">
          <RadioGroup
            legend="Animation"
            columns={1}
            value={settings.motion}
            onChange={(motion) => update({ motion })}
            hint={`Now: ${resolved.reduceMotion ? 'reduced' : 'full'} motion. Reduced motion removes transitions and animations, and the Algorithm Lab jumps to the finished run instead of playing it.`}
            options={[
              { value: 'system', label: 'Match system', hint: 'Follows your operating system setting' },
              { value: 'reduced', label: 'Reduce motion' },
              { value: 'full', label: 'Full motion' },
            ]}
          />
        </Card>

        <Card meta="Map" title="Map preferences">
          <div className="flex flex-col gap-5">
            <RadioGroup
              legend="Map style"
              columns={3}
              value={settings.mapTiles}
              onChange={(mapTiles) => update({ mapTiles })}
              hint={`Now showing ${resolved.tiles === 'dark' ? 'dark-tinted' : 'standard'} tiles.`}
              options={[{ value: 'auto', label: 'Match theme' }, { value: 'dark', label: 'Dark tint' }, { value: 'standard', label: 'Standard' }]}
            />
            <Select label="Default zoom" value={settings.mapZoom} onChange={(e) => update({ mapZoom: Number(e.target.value) })} options={ZOOMS} hint="Used when the Route Planner opens, before a route is drawn." />
            <Toggle label="Fit route to view" description="Zoom the map to the whole route after each calculation." checked={settings.mapAutoFit} onChange={(mapAutoFit) => update({ mapAutoFit })} />
          </div>
        </Card>

        <Card meta="Planner" title="Routing and units">
          <div className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Default algorithm" value={settings.defaultAlgorithm} onChange={(e) => update({ defaultAlgorithm: e.target.value })} options={[{ value: 'dijkstra', label: 'Dijkstra' }, { value: 'astar', label: 'A*' }]} />
              <Select label="Default route type" value={settings.defaultRouteType} onChange={(e) => update({ defaultRouteType: e.target.value })} options={[{ value: 'shortest', label: 'Shortest (distance)' }, { value: 'fastest', label: 'Fastest (est. time)' }]} />
            </div>
            <RadioGroup
              legend="Distance units"
              value={settings.units}
              onChange={(units) => update({ units })}
              hint={`Example: 1500 m is shown as ${formatDistance(1500, settings.units)}.`}
              options={[{ value: 'km', label: 'Kilometres', hint: 'km and m' }, { value: 'mi', label: 'Miles', hint: 'mi and ft' }]}
            />
          </div>
        </Card>
      </div>

      <Card meta="Workspace" title="Control session" actions={<Badge tone="green">Control held</Badge>}>
        <dl className="grid gap-4 font-mono text-xs sm:grid-cols-4">
          <div><dt className="nx-label">Operator</dt><dd className="mt-1 text-sm text-ink">{session?.label || 'Not named'}</dd></div>
          <div><dt className="nx-label">Workspace</dt><dd className="mt-1 text-sm text-ink">…{session?.workspaceId.slice(-6)}</dd></div>
          <div><dt className="nx-label">Saved routes</dt><dd className="mt-1 text-sm text-ink">{info.data ? info.data.counts.savedRoutes : '…'}</dd></div>
          <div><dt className="nx-label">History entries</dt><dd className="mt-1 text-sm text-ink">{info.data ? info.data.counts.history : '…'}</dd></div>
        </dl>
        {session?.createdAt && <p className="mt-3 font-mono text-xs text-muted">Created {formatDateTime(session.createdAt)}. This is an anonymous workspace, not an account: anyone with its key can open it.</p>}
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => open('release')}>Release control</Button>
          <Button variant="danger" onClick={() => open('clear')}>Clear route history</Button>
          <Button variant="danger" onClick={() => open('erase')}>Erase all workspace data</Button>
        </div>
      </Card>

      <div><Button variant="ghost" onClick={() => open('reset')}>Reset settings to defaults</Button></div>

      <ConfirmDialog
        open={dialog === 'reset'} title="Reset settings?" tone="primary" confirmLabel="Reset settings"
        description="Theme, motion, map, routing and unit settings return to their defaults. Your saved routes and history are not affected."
        loading={busy.loading} error={busy.error} onCancel={close}
        onConfirm={() => run(async () => reset(), 'Settings reset to defaults.')}
      />
      <ConfirmDialog
        open={dialog === 'clear'} title="Clear route history?" confirmLabel="Clear history"
        description="All logged calculations are deleted and analytics start from zero. Saved routes are not affected. This cannot be undone."
        loading={busy.loading} error={busy.error} onCancel={close}
        onConfirm={() => run(clearHistory, 'Route history cleared.', info.reload)}
      />
      <ConfirmDialog
        open={dialog === 'erase'} title="Erase all workspace data?" confirmLabel="Erase everything"
        description="This permanently deletes your saved routes and route history from the server and releases control. This cannot be undone."
        loading={busy.loading} error={busy.error} onCancel={close}
        onConfirm={() => run(() => release({ erase: true }), 'Workspace erased.', () => navigate('/'))}
      />
      <ReleaseControlDialog open={dialog === 'release'} onClose={close} />
    </div>
  );
}
