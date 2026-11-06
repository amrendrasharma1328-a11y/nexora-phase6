import Card from '../ui/Card.jsx';
import Badge from '../ui/Badge.jsx';
import BarChart from '../ui/BarChart.jsx';
import BarList from '../ui/BarList.jsx';
import StatCard from '../dashboard/StatCard.jsx';
import { algorithmName, formatMs, formatPercent } from '../../api/format.js';
import { useUnits } from '../../hooks/useUnits.js';

const shortDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Presentational analytics panels for an analytics payload (real or demo). */
export default function AnalyticsView({ data, demo = false }) {
  const { formatDistance, formatDuration, distanceInUnit, unitLabel } = useUnits();
  const { totals, averages, algorithms, topDestinations, trend } = data;
  const rangeText = data.range.days ? `last ${data.range.days} days` : 'all recorded history';
  const perDay = trend.points.map((p) => ({ key: p.date, label: shortDate(p.date), value: p.count }));
  const distPerDay = trend.points.map((p) => ({ key: p.date, label: shortDate(p.date), value: p.avgDistanceMeters === null ? null : distanceInUnit(p.avgDistanceMeters) }));
  const activeDays = trend.points.filter((p) => p.count > 0).length;
  const maxExec = Math.max(...algorithms.map((a) => a.avgExecutionTimeMs ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Routes calculated" value={String(totals.routesCalculated)} hint={totals.noPath ? `${totals.noPath} found no path` : rangeText} demo={demo} />
        <StatCard label="Average distance" value={formatDistance(averages.distanceMeters)} hint="Routes with a path" demo={demo} />
        <StatCard label="Average est. time" value={formatDuration(averages.estimatedTimeSeconds)} hint="Assumed speeds, not live traffic" demo={demo} />
        <StatCard label="Avg execution time" value={formatMs(averages.executionTimeMs)} hint="Server-side algorithm time" demo={demo} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card meta="Trend" title="Routes per day" actions={demo ? <Badge tone="magenta">Demo</Badge> : null}>
          <BarChart data={perDay} title="Routes calculated per day" valueLabel="Routes" formatValue={(v) => String(v ?? 0)} summary={`${totals.routesCalculated} routes across ${activeDays} active days in the ${rangeText}.`} />
        </Card>
        <Card meta="Trend" title={`Average distance per day (${unitLabel})`} actions={demo ? <Badge tone="magenta">Demo</Badge> : null}>
          <BarChart tone="cyan" data={distPerDay} title={`Average route distance per day in ${unitLabel}`} valueLabel={`Avg ${unitLabel}`} formatValue={(v) => (v === null ? 'no routes' : `${v.toFixed(2)} ${unitLabel}`)} summary={`Average distance on days with routes, in ${unitLabel}.`} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card meta="Usage" title="Algorithm usage" actions={demo ? <Badge tone="magenta">Demo</Badge> : null}>
          <BarList label="Routes per algorithm" max={Math.max(...algorithms.map((a) => a.count), 0)} items={algorithms.map((a) => ({ id: a.algorithm, label: algorithmName(a.algorithm), value: a.count, display: `${a.count} (${formatPercent(a.share)})`, tone: a.algorithm === 'astar' ? 'cyan' : 'green' }))} />
        </Card>
        <Card meta="Performance" title="Average execution time" actions={demo ? <Badge tone="magenta">Demo</Badge> : null}>
          <BarList label="Average execution time per algorithm" max={maxExec} items={algorithms.map((a) => ({
            id: a.algorithm, label: algorithmName(a.algorithm), value: a.avgExecutionTimeMs ?? 0, display: a.avgExecutionTimeMs === null ? 'no data' : formatMs(a.avgExecutionTimeMs), tone: a.algorithm === 'astar' ? 'cyan' : 'green',
            note: a.avgNodesVisited === null ? undefined : `${Math.round(a.avgNodesVisited)} nodes visited on average`,
          }))} />
          <p className="mt-3 font-mono text-[0.6875rem] text-muted">Measured on the server. It depends on hardware, graph size and the trips you chose, so compare algorithms only on similar routes.</p>
        </Card>
        <Card meta="Destinations" title="Most searched destinations" actions={demo ? <Badge tone="magenta">Demo</Badge> : null}>
          {topDestinations.length === 0 ? <p className="font-mono text-xs text-muted">No destinations in this period.</p> : (
            <BarList label="Most searched destinations" items={topDestinations.map((d) => ({ id: d.label, label: d.label, value: d.count, display: `${d.count} ${d.count === 1 ? 'search' : 'searches'}` }))} />
          )}
        </Card>
      </div>
    </div>
  );
}
