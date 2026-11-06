import { useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import BarList from '../components/ui/BarList.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import ErrorState from '../components/ui/ErrorState.jsx';
import LoadingIndicator from '../components/ui/LoadingIndicator.jsx';
import StatCard from '../components/dashboard/StatCard.jsx';
import SystemStatus from '../components/dashboard/SystemStatus.jsx';
import GraphStat from '../components/dashboard/GraphStat.jsx';
import { useGraphStats } from '../hooks/useGraphStats.js';
import { useResource } from '../hooks/useResource.js';
import { useUnits } from '../hooks/useUnits.js';
import { getAnalytics, listHistory } from '../api/client.js';
import { algorithmName, formatDateTime, formatPercent } from '../api/format.js';

const linkBtn = 'inline-flex h-8 items-center border border-control px-3 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-primary hover:border-primary hover:bg-primary/10';

/** Dashboard: every number comes from the stored route history (no demo data). */
export default function Dashboard() {
  const { health } = useOutletContext();
  const graphStats = useGraphStats();
  const navigate = useNavigate();
  const { formatDistance, formatDuration } = useUnits();
  const analytics = useResource(() => getAnalytics('all'));
  const recent = useResource(() => listHistory({ limit: 5 }));
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  function goPlanner(e) {
    e.preventDefault();
    navigate('/app/route-planner', { state: { from: from.trim(), to: to.trim() } });
  }

  const a = analytics.data;
  const none = a && a.totals.routesCalculated === 0;
  const stat = (v) => (a ? v : '…');

  return (
    <div className="flex flex-col gap-6">
      {analytics.status === 'error' && !a && <ErrorState title="Could not load your statistics" message={analytics.error} onRetry={analytics.reload} />}

      <section aria-label="Overview statistics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Routes calculated" value={stat(String(a?.totals.routesCalculated))} hint="All recorded history" />
        <StatCard label="Saved routes" value={stat(String(a?.totals.savedRoutes))} hint="In your workspace" />
        <StatCard label="Average distance" value={stat(formatDistance(a?.averages.distanceMeters))} hint={none ? 'Calculate a route to see this' : 'Routes with a path'} />
        <StatCard label="Average est. time" value={stat(formatDuration(a?.averages.estimatedTimeSeconds))} hint="Assumed speeds, not live traffic" />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card meta="Latest" title="Recent Routes" actions={<Link to="/app/history" className={linkBtn}>View all</Link>}>
            {recent.status === 'loading' && !recent.data ? <LoadingIndicator label="Loading recent routes" />
              : recent.status === 'error' && !recent.data ? <ErrorState title="Could not load recent routes" message={recent.error} onRetry={recent.reload} />
              : recent.data.items.length === 0 ? (
                <EmptyState icon="route" title="No routes yet" description="Routes you calculate will appear here." action={<Link to="/app/route-planner" className={linkBtn}>Plan a route</Link>} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-left font-mono text-xs">
                    <caption className="sr-only">Recent routes</caption>
                    <thead>
                      <tr className="nx-label border-b border-border">
                        <th scope="col" className="py-2 pr-3 font-normal">Route</th>
                        <th scope="col" className="py-2 pr-3 font-normal">Algorithm</th>
                        <th scope="col" className="py-2 pr-3 font-normal">Distance</th>
                        <th scope="col" className="py-2 font-normal">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.data.items.map((r) => (
                        <tr key={r.id} className="border-b border-border/50">
                          <td className="py-2 pr-3 text-ink">{r.source.label} → {r.destination.label}</td>
                          <td className="py-2 pr-3"><Badge tone="cyan">{algorithmName(r.algorithm)}</Badge></td>
                          <td className="py-2 pr-3">{r.found ? formatDistance(r.distanceMeters) : 'No path'}</td>
                          <td className="py-2">{formatDateTime(r.at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card meta="Searches" title="Popular Destinations">
              {!a ? <LoadingIndicator label="Loading" /> : a.topDestinations.length === 0
                ? <p className="font-mono text-xs text-muted">Your most searched destinations will show up here.</p>
                : <BarList label="Most searched destinations" items={a.topDestinations.slice(0, 4).map((d) => ({ id: d.label, label: d.label, value: d.count, display: `${d.count}` }))} />}
            </Card>
            <Card meta="Usage" title="Algorithm Usage">
              {!a ? <LoadingIndicator label="Loading" /> : none
                ? <p className="font-mono text-xs text-muted">Run a route with Dijkstra or A* to compare them here.</p>
                : <BarList label="Routes per algorithm" items={a.algorithms.map((x) => ({ id: x.algorithm, label: algorithmName(x.algorithm), value: x.count, display: `${x.count} (${formatPercent(x.share)})`, tone: x.algorithm === 'astar' ? 'cyan' : 'green', note: x.avgNodesVisited === null ? undefined : `${Math.round(x.avgNodesVisited)} nodes visited on average` }))} />}
            </Card>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <Card meta="Shortcut" title="Quick Route Planner">
            <form onSubmit={goPlanner} className="flex flex-col gap-3">
              <Input label="Source" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Starting point" />
              <Input label="Destination" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Where to?" />
              <Button type="submit">Open Route Planner</Button>
            </form>
            <p className="mt-3 font-mono text-xs text-muted">Opens the planner with your destination pre-filled in the search box.</p>
          </Card>
          <SystemStatus health={health} />
        </div>
      </div>

      <section aria-label="Algorithm information" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card meta="Algorithm" title="Dijkstra">
          <p className="text-sm">Finds the lowest-cost path on graphs with non-negative weights, expanding nodes in order of cost.</p>
          <p className="mt-2 font-mono text-xs text-muted">O((V+E) log V) with a binary heap</p>
        </Card>
        <Card meta="Algorithm" title="A* Algorithm">
          <p className="text-sm">Dijkstra guided by a heuristic, f = g + h. Optimal when the heuristic never overestimates.</p>
          <p className="mt-2 font-mono text-xs text-muted">Typically explores fewer nodes</p>
        </Card>
        <GraphStat title="Graph Nodes" field="vertexCount" stats={graphStats} />
        <GraphStat title="Graph Edges" field="edgeCount" stats={graphStats} />
      </section>
    </div>
  );
}
