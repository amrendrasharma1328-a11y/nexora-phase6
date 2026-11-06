import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import LoadingIndicator from '../components/ui/LoadingIndicator.jsx';
import ErrorState from '../components/ui/ErrorState.jsx';
import Select from '../components/ui/Select.jsx';
import MapView from '../components/map/MapView.jsx';
import PlaceSearch from '../components/planner/PlaceSearch.jsx';
import RouteSummary from '../components/planner/RouteSummary.jsx';
import SaveRouteDialog from '../components/planner/SaveRouteDialog.jsx';
import { useGraphStats } from '../hooks/useGraphStats.js';
import { calculateRoute } from '../api/client.js';
import { useSettings } from '../context/SettingsContext.jsx';
import { useNotify } from '../context/ToastContext.jsx';
import { metricToRouteType, samePlace } from '../routing/routeTypes.js';

const FALLBACK_CENTER = [26.85, 80.95];

function DataSourceBanner({ stats }) {
  if (stats.status === 'loading') return <LoadingIndicator label="Loading road network info" />;
  if (stats.status === 'error') return <ErrorState title="Backend unavailable" message={stats.error} onRetry={stats.refresh} />;
  const ds = stats.data.dataSource;
  if (ds.type === 'osm') {
    return (
      <p className="flex flex-wrap items-center gap-2 border border-border px-3 py-2 font-mono text-xs text-body">
        <Badge tone="green">OSM road data</Badge>
        {ds.region} · data fetched {new Date(ds.fetchedAt).toLocaleDateString()} · {ds.attribution}. Not live traffic.
      </p>
    );
  }
  return (
    <p role="alert" className="border border-secondary px-3 py-2 font-mono text-xs text-body">
      <Badge tone="magenta" className="mr-2">Sample graph</Badge>
      The backend is using a SYNTHETIC grid, not real roads. Run <code>npm run fetch-osm</code> in <code>backend/</code> and restart it to load real OpenStreetMap roads.
    </p>
  );
}

/** What must be true before a route can be calculated. @returns {string|null} an error message, or null when valid */
export function validatePlan({ source, destination }) {
  if (!source && !destination) return 'Choose a source and a destination.';
  if (!source) return 'Choose a source.';
  if (!destination) return 'Choose a destination.';
  if (samePlace(source, destination)) return 'Source and destination are the same place. Choose two different points.';
  return null;
}

/**
 * Route Planner: search/pick two points, run Dijkstra or A* on the backend graph, draw the real road geometry.
 * Can be opened with a saved route or a history entry (location.state.preset): it fills the form and recalculates
 * against the current road graph, so a reopened route is never stale.
 */
export default function RoutePlanner() {
  const stats = useGraphStats();
  const location = useLocation();
  const navigate = useNavigate();
  const notify = useNotify();
  const { settings } = useSettings();
  const prefill = location.state ?? {};
  const [source, setSource] = useState(null);
  const [destination, setDestination] = useState(null);
  const [picking, setPicking] = useState(null); // 'source' | 'destination' | null
  const [algorithm, setAlgorithm] = useState(settings.defaultAlgorithm);
  const [routeType, setRouteType] = useState(settings.defaultRouteType);
  const [run, setRun] = useState({ status: 'idle', result: null, plan: null, error: null, id: 0 });
  const [formError, setFormError] = useState(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saved, setSaved] = useState(null); // { runId, id, name }
  const latest = useRef(0);
  const consumedPreset = useRef(null);

  const box = stats.data?.graph?.boundingBox;
  const center = useMemo(() => (box ? [(box.minLat + box.maxLat) / 2, (box.minLng + box.maxLng) / 2] : FALLBACK_CENTER), [box]);

  function pickOnMap(p) {
    const point = { label: `Map point ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`, ...p };
    if (picking === 'source') setSource(point); else setDestination(point);
    setPicking(null);
    setFormError(null);
  }

  async function calculate(plan = { source, destination, algorithm, routeType }) {
    const problem = validatePlan(plan);
    if (problem) { setFormError(problem); return; }
    setFormError(null);
    const id = ++latest.current;
    setRun({ status: 'loading', result: null, plan, error: null, id });
    try {
      const result = await calculateRoute(plan);
      if (id === latest.current) setRun({ status: 'done', result, plan, error: null, id });
    } catch (err) {
      if (id === latest.current) setRun({ status: 'error', result: null, plan, error: err.message, id });
    }
  }

  // Opened from Saved Routes or Route History: fill the form, then calculate once.
  useEffect(() => {
    const preset = location.state?.preset;
    if (!preset || consumedPreset.current === location.key) return;
    consumedPreset.current = location.key;
    const plan = { source: preset.source, destination: preset.destination, algorithm: preset.algorithm, routeType: metricToRouteType(preset.metric) };
    setSource(plan.source); setDestination(plan.destination); setAlgorithm(plan.algorithm); setRouteType(plan.routeType);
    navigate(location.pathname, { replace: true, state: null }); // a page refresh must not repeat the calculation
    if (preset.notice) notify.info(preset.notice);
    calculate(plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  function reset() {
    latest.current += 1;
    setSource(null); setDestination(null); setPicking(null); setFormError(null); setSaved(null);
    setRun({ status: 'idle', result: null, plan: null, error: null, id: 0 });
  }

  const route = run.result?.found ? run.result.routeGeometry : null;
  const savedForRun = saved && saved.runId === run.id ? saved : null;
  const canSave = run.status === 'done' && run.result?.found;

  return (
    <div className="flex flex-col gap-4">
      <DataSourceBanner stats={stats} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-1">
          <Card meta="Plan" title="Route Planner">
            {/* A div, not a form: each PlaceSearch contains its own search form and forms cannot nest. */}
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <PlaceSearch label="Source" point={source} onSelect={(p) => { setSource(p); setFormError(null); }} initialQuery={prefill.from ?? ''} />
                <Button size="sm" variant={picking === 'source' ? 'primary' : 'ghost'} onClick={() => setPicking(picking === 'source' ? null : 'source')}>
                  {picking === 'source' ? 'Click the map…' : 'Pick source on map'}
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                <PlaceSearch label="Destination" point={destination} onSelect={(p) => { setDestination(p); setFormError(null); }} initialQuery={prefill.to ?? ''} />
                <Button size="sm" variant={picking === 'destination' ? 'primary' : 'ghost'} onClick={() => setPicking(picking === 'destination' ? null : 'destination')}>
                  {picking === 'destination' ? 'Click the map…' : 'Pick destination on map'}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Select label="Algorithm" value={algorithm} onChange={(e) => setAlgorithm(e.target.value)} options={[{ value: 'dijkstra', label: 'Dijkstra' }, { value: 'astar', label: 'A*' }]} />
                <Select label="Route type" value={routeType} onChange={(e) => setRouteType(e.target.value)} options={[{ value: 'shortest', label: 'Shortest (distance)' }, { value: 'fastest', label: 'Fastest (est. time)' }]} />
              </div>

              <div className="flex gap-2">
                <Button onClick={() => calculate()} loading={run.status === 'loading'} className="flex-1">Calculate route</Button>
                <Button variant="ghost" onClick={reset}>Reset</Button>
              </div>
              {formError
                ? <p role="alert" className="font-mono text-xs text-secondary">{formError}</p>
                : (!source || !destination) && <p className="font-mono text-xs text-muted">Choose both a source and a destination to calculate a route.</p>}
            </div>
          </Card>

          {run.status === 'loading' && <LoadingIndicator label="Calculating route" />}
          {run.status === 'error' && <ErrorState title="Route failed" message={run.error} onRetry={() => calculate(run.plan)} />}
          {run.status === 'done' && <RouteSummary result={run.result} saved={savedForRun} onSave={canSave ? () => setSaveOpen(true) : undefined} />}
        </div>

        <div className="lg:col-span-2">
          {stats.status === 'loading' ? <LoadingIndicator label="Loading map" /> : (
            <MapView center={center} zoom={settings.mapZoom} source={source} destination={destination} route={route} picking={picking !== null} onPick={pickOnMap} />
          )}
        </div>
      </div>

      {canSave && (
        <SaveRouteDialog
          key={run.id}
          open={saveOpen}
          onClose={() => setSaveOpen(false)}
          plan={run.plan}
          result={run.result}
          onSaved={(record) => setSaved({ runId: run.id, id: record.id, name: record.name })}
        />
      )}
    </div>
  );
}
