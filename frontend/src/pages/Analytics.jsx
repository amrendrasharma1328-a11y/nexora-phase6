import { useState } from 'react';
import { Link } from 'react-router-dom';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import Select from '../components/ui/Select.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import ErrorState from '../components/ui/ErrorState.jsx';
import LoadingIndicator from '../components/ui/LoadingIndicator.jsx';
import AnalyticsView from '../components/analytics/AnalyticsView.jsx';
import { useResource } from '../hooks/useResource.js';
import { getAnalytics } from '../api/client.js';
import { buildDemoAnalytics } from '../data/demoAnalytics.js';

const RANGES = [
  { value: '7d', label: 'Last 7 days' }, { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' }, { value: 'all', label: 'All time' },
];

/** Analytics computed from the stored route history. Demo data only appears when explicitly requested. */
export default function Analytics() {
  const [range, setRange] = useState('30d');
  const [demo, setDemo] = useState(false);
  const res = useResource(() => getAnalytics(range), [range]);

  const controls = (
    <div className="flex flex-wrap items-end gap-3">
      <Select label="Period" value={range} onChange={(e) => setRange(e.target.value)} options={RANGES} />
      <Button variant="secondary" onClick={res.reload} loading={res.refreshing}>Refresh</Button>
    </div>
  );

  if (res.status === 'loading' && !res.data) return <LoadingIndicator label="Loading analytics" />;
  if (res.status === 'error' && !res.data) return <ErrorState title="Could not load analytics" message={res.error} onRetry={res.reload} />;

  const hasData = res.data.totals.routesCalculated > 0;
  if (demo) {
    return (
      <div className="flex flex-col gap-6">
        {controls}
        <p role="note" className="flex flex-wrap items-center gap-2 border border-secondary px-3 py-2 font-mono text-xs text-body">
          <Badge tone="magenta">Demo data</Badge>
          Illustrative numbers, not your history. They exist only so you can preview this page.
          <Button size="sm" variant="secondary" onClick={() => setDemo(false)} className="ml-auto">Back to my data</Button>
        </p>
        <AnalyticsView data={buildDemoAnalytics(range)} demo />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {controls}
      {res.status === 'error' && <p role="alert" className="font-mono text-xs text-secondary">{res.error}</p>}
      {hasData ? <AnalyticsView data={res.data} /> : (
        <EmptyState
          icon="chart"
          title="No routes in this period"
          description={range === 'all' ? 'Analytics are computed from your route history. Calculate a route and the numbers will appear here.' : 'Nothing was calculated in this period. Try All time, or calculate a route.'}
          action={(
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/app/route-planner" className="border border-primary bg-primary px-4 py-2 font-mono text-xs uppercase tracking-[0.12em] text-bg hover:bg-ink">Plan a route</Link>
              <Button variant="secondary" onClick={() => setDemo(true)}>Preview with demo data</Button>
            </div>
          )}
        />
      )}
    </div>
  );
}
