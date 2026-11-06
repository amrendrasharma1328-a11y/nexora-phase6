import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import Select from '../components/ui/Select.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import ErrorState from '../components/ui/ErrorState.jsx';
import LoadingIndicator from '../components/ui/LoadingIndicator.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import { useUnits } from '../hooks/useUnits.js';
import { useNotify } from '../context/ToastContext.jsx';
import { clearHistory, listHistory } from '../api/client.js';
import { algorithmName, formatDateTime, formatMs } from '../api/format.js';
import { metricLabel } from '../routing/routeTypes.js';

const PAGE = 25;
const FILTERS = [{ value: '', label: 'All algorithms' }, { value: 'dijkstra', label: 'Dijkstra' }, { value: 'astar', label: 'A*' }];

/** Every route calculation made while holding control, newest first. */
export default function History() {
  const { formatDistance, formatDuration } = useUnits();
  const navigate = useNavigate();
  const notify = useNotify();
  const [algorithm, setAlgorithm] = useState('');
  const [state, setState] = useState({ status: 'loading', items: [], total: 0, error: null, more: false });
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState({ loading: false, error: null });

  const load = useCallback(async (offset, filter) => {
    setState((s) => ({ ...s, status: offset === 0 ? 'loading' : s.status, more: offset > 0 }));
    try {
      const page = await listHistory({ limit: PAGE, offset, algorithm: filter || undefined });
      setState((s) => ({ status: 'ok', items: offset === 0 ? page.items : [...s.items, ...page.items], total: page.total, error: null, more: false }));
    } catch (err) {
      setState((s) => ({ ...s, status: 'error', error: err.message, more: false }));
    }
  }, []);

  useEffect(() => { load(0, algorithm); }, [load, algorithm]);

  function planAgain(h) {
    if (h.source.lat === null || h.destination.lat === null) { notify.error('This entry has no coordinates, so it cannot be reopened.'); return; }
    navigate('/app/route-planner', { state: { preset: { source: h.source, destination: h.destination, algorithm: h.algorithm, metric: h.metric, notice: 'Calculating this route again.' } } });
  }

  async function doClear() {
    setClearing({ loading: true, error: null });
    try {
      const r = await clearHistory();
      setConfirmClear(false);
      setClearing({ loading: false, error: null });
      notify.success(`Cleared ${r.removed} history ${r.removed === 1 ? 'entry' : 'entries'}. Saved routes are untouched.`);
      load(0, algorithm);
    } catch (err) {
      setClearing({ loading: false, error: err.message });
    }
  }

  if (state.status === 'loading' && state.items.length === 0 && !state.more) return <LoadingIndicator label="Loading route history" />;
  if (state.status === 'error' && state.items.length === 0) return <ErrorState title="Could not load route history" message={state.error} onRetry={() => load(0, algorithm)} />;

  const empty = state.items.length === 0;
  return (
    <div className="flex flex-col gap-4">
      {empty && !algorithm ? (
        <EmptyState icon="history" title="No routes calculated yet" description="Each route you calculate is logged here with its places, algorithm, distance, estimated time and timestamp." action={<Link to="/app/route-planner" className="border border-primary bg-primary px-4 py-2 font-mono text-xs uppercase tracking-[0.12em] text-bg hover:bg-ink">Plan a route</Link>} />
      ) : (
        <Card meta="History" title="Calculated routes" actions={<Button size="sm" variant="danger" onClick={() => { setClearing({ loading: false, error: null }); setConfirmClear(true); }} disabled={state.total === 0}>Clear history</Button>}>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <Select label="Algorithm" value={algorithm} onChange={(e) => setAlgorithm(e.target.value)} options={FILTERS} />
            <p className="ml-auto font-mono text-xs text-muted" role="status">{state.total} {state.total === 1 ? 'entry' : 'entries'}</p>
          </div>
          {empty ? (
            <EmptyState icon="search" title="No routes for this algorithm" description="Calculate a route with this algorithm and it will show up here." action={<Button variant="secondary" onClick={() => setAlgorithm('')}>Show all algorithms</Button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-left font-mono text-xs">
                <caption className="sr-only">Route history, newest first</caption>
                <thead>
                  <tr className="nx-label border-b border-border">
                    {['When', 'Route', 'Algorithm', 'Distance', 'Est. time', 'Run time', ''].map((h) => <th key={h || 'actions'} scope="col" className="py-2 pr-3 font-normal">{h || <span className="sr-only">Actions</span>}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {state.items.map((h) => (
                    <tr key={h.id} className="border-b border-border/50 align-top">
                      <td className="py-2 pr-3 text-body">{formatDateTime(h.at)}</td>
                      <td className="max-w-xs py-2 pr-3 text-ink"><span className="break-words">{h.source.label}</span><span className="text-muted"> to </span><span className="break-words">{h.destination.label}</span></td>
                      <td className="py-2 pr-3"><Badge tone="cyan">{algorithmName(h.algorithm)}</Badge> <span className="text-muted">{metricLabel(h.metric)}</span></td>
                      <td className="py-2 pr-3">{h.found ? formatDistance(h.distanceMeters) : <Badge tone="magenta">No path</Badge>}</td>
                      <td className="py-2 pr-3">{h.found ? formatDuration(h.estimatedTimeSeconds) : '—'}</td>
                      <td className="py-2 pr-3">{formatMs(h.executionTimeMs)}</td>
                      <td className="py-2"><Button size="sm" variant="secondary" onClick={() => planAgain(h)} aria-label={`Plan again: ${h.source.label} to ${h.destination.label}`}>Plan again</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {state.status === 'error' && <p role="alert" className="mt-3 font-mono text-xs text-secondary">{state.error}</p>}
          {state.items.length < state.total && (
            <div className="mt-4 flex justify-center"><Button variant="secondary" loading={state.more} onClick={() => load(state.items.length, algorithm)}>Load more</Button></div>
          )}
          <p className="mt-4 font-mono text-xs text-muted">Run time is how long the algorithm took on the server. The most recent 1000 calculations are kept.</p>
        </Card>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Clear route history?"
        description="All logged calculations will be deleted and analytics will start from zero. Saved routes are not affected. This cannot be undone."
        confirmLabel="Clear history"
        loading={clearing.loading}
        error={clearing.error}
        onConfirm={doClear}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
