import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import SearchInput from '../components/ui/SearchInput.jsx';
import Select from '../components/ui/Select.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import ErrorState from '../components/ui/ErrorState.jsx';
import LoadingIndicator from '../components/ui/LoadingIndicator.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import { useResource } from '../hooks/useResource.js';
import { useUnits } from '../hooks/useUnits.js';
import { useNotify } from '../context/ToastContext.jsx';
import { deleteSavedRoute, listSavedRoutes } from '../api/client.js';
import { algorithmName, formatDateTime } from '../api/format.js';
import { metricLabel } from '../routing/routeTypes.js';

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'name', label: 'Name (A to Z)' },
  { value: 'distance', label: 'Distance (shortest first)' },
];
const sorters = {
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  name: (a, b) => a.name.localeCompare(b.name),
  distance: (a, b) => a.distanceMeters - b.distanceMeters,
};

function SavedRouteCard({ route, onOpen, onDelete }) {
  const { formatDistance, formatDuration } = useUnits();
  return (
    <li>
      <Card as="article" className="h-full">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="min-w-0 break-words text-base font-semibold">{route.name}</h3>
          <div className="flex gap-2">
            <Badge tone="cyan">{algorithmName(route.algorithm)}</Badge>
            <Badge>{metricLabel(route.metric)}</Badge>
            {route.dataSource === 'sample' && <Badge tone="magenta">Sample graph</Badge>}
          </div>
        </div>
        <dl className="mt-3 grid gap-3 font-mono text-xs sm:grid-cols-2">
          <div className="min-w-0"><dt className="nx-label">From</dt><dd className="mt-1 break-words text-ink">{route.source.label}</dd></div>
          <div className="min-w-0"><dt className="nx-label">To</dt><dd className="mt-1 break-words text-ink">{route.destination.label}</dd></div>
          <div><dt className="nx-label">Distance</dt><dd className="mt-1 text-sm text-ink">{formatDistance(route.distanceMeters)}</dd></div>
          <div><dt className="nx-label">Estimated time</dt><dd className="mt-1 text-sm text-ink">{formatDuration(route.estimatedTimeSeconds)}</dd></div>
        </dl>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <p className="font-mono text-xs text-muted">Saved {formatDateTime(route.createdAt)}</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onOpen(route)} aria-label={`Open ${route.name}`}>Open</Button>
            <Button size="sm" variant="danger" onClick={() => onDelete(route)} aria-label={`Delete ${route.name}`}>Delete</Button>
          </div>
        </div>
      </Card>
    </li>
  );
}

/** Saved routes of the current workspace: view, open in the planner, delete. */
export default function SavedRoutes() {
  const res = useResource(listSavedRoutes);
  const navigate = useNavigate();
  const notify = useNotify();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState({ loading: false, error: null });

  const items = res.data?.items ?? [];
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? items.filter((r) => [r.name, r.source.label, r.destination.label].some((t) => t.toLowerCase().includes(q))) : items;
    return [...filtered].sort(sorters[sort]);
  }, [items, query, sort]);

  function open(route) {
    navigate('/app/route-planner', {
      state: { preset: { source: route.source, destination: route.destination, algorithm: route.algorithm, metric: route.metric, notice: `Recalculating “${route.name}” on the current road network.` } },
    });
  }

  async function confirmDelete() {
    setDeleting({ loading: true, error: null });
    try {
      await deleteSavedRoute(pendingDelete.id);
      res.setData((d) => ({ ...d, items: d.items.filter((r) => r.id !== pendingDelete.id), total: d.total - 1 }));
      notify.success(`Deleted “${pendingDelete.name}”.`);
      setPendingDelete(null);
      setDeleting({ loading: false, error: null });
    } catch (err) {
      if (err.code === 'NOT_FOUND') { // already gone (another tab): reflect reality
        res.setData((d) => ({ ...d, items: d.items.filter((r) => r.id !== pendingDelete.id), total: d.total - 1 }));
        setPendingDelete(null);
        setDeleting({ loading: false, error: null });
        notify.info('That route was already deleted.');
      } else {
        setDeleting({ loading: false, error: err.message });
      }
    }
  }

  if (res.status === 'loading' && !res.data) return <LoadingIndicator label="Loading saved routes" />;
  if (res.status === 'error' && !res.data) return <ErrorState title="Could not load saved routes" message={res.error} onRetry={res.reload} />;

  return (
    <div className="flex flex-col gap-4">
      {items.length === 0 ? (
        <EmptyState
          icon="bookmark"
          title="No saved routes yet"
          description="Calculate a route in the Route Planner, then choose Save route to keep it here and reopen it in one click."
          action={<Link to="/app/route-planner" className="border border-primary bg-primary px-4 py-2 font-mono text-xs uppercase tracking-[0.12em] text-bg hover:bg-ink">Plan a route</Link>}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <SearchInput label="Filter saved routes" placeholder="Filter by name or place…" value={query} onChange={setQuery} className="w-full sm:w-72" />
            <Select label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} options={SORTS} />
            <p className="ml-auto font-mono text-xs text-muted" role="status">{visible.length === items.length ? `${items.length} saved of ${res.data.limit} allowed` : `${visible.length} of ${items.length} shown`}</p>
          </div>
          {visible.length === 0 ? (
            <EmptyState icon="search" title="No saved routes match" description={`Nothing matches “${query.trim()}”.`} action={<Button variant="secondary" onClick={() => setQuery('')}>Clear filter</Button>} />
          ) : (
            <ul className="grid gap-4 xl:grid-cols-2">
              {visible.map((r) => <SavedRouteCard key={r.id} route={r} onOpen={open} onDelete={(route) => { setDeleting({ loading: false, error: null }); setPendingDelete(route); }} />)}
            </ul>
          )}
          <p className="font-mono text-xs text-muted">Distance and time are the values from when you saved the route. Opening a route recalculates it on the current road network.</p>
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete saved route?"
        description={pendingDelete ? `“${pendingDelete.name}” will be removed from your saved routes. Your route history is not affected.` : ''}
        confirmLabel="Delete route"
        loading={deleting.loading}
        error={deleting.error}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
