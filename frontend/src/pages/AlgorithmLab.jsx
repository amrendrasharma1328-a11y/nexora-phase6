import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import LoadingIndicator from '../components/ui/LoadingIndicator.jsx';
import ErrorState from '../components/ui/ErrorState.jsx';
import GraphCanvas from '../components/lab/GraphCanvas.jsx';
import LabLegend from '../components/lab/LabLegend.jsx';
import LabMetrics from '../components/lab/LabMetrics.jsx';
import CompareView from '../components/lab/CompareView.jsx';
import { getLabGraph, runLab, compareLab } from '../api/client.js';
import { LabPlayer } from '../lab/LabPlayer.js';
import { useSettings } from '../context/SettingsContext.jsx';
import { createLabState, describeEvent } from '../lab/labState.js';

const SIZES = [8, 12, 16, 20];
const SPEEDS = [0.5, 1, 2, 5, 10];
const selectClass = 'h-10 border border-control bg-bg px-3 font-mono text-sm text-ink hover:border-primary';
const STATUS_TEXT = { idle: 'Ready', playing: 'Playing', paused: 'Paused', done: 'Finished' };

/** Algorithm Lab: replays REAL Dijkstra / A* execution events recorded by the backend engine. */
export default function AlgorithmLab() {
  const { resolved: { reduceMotion } } = useSettings();
  const [size, setSize] = useState(12);
  const [graphState, setGraphState] = useState({ status: 'loading', graph: null, error: null });
  const [source, setSource] = useState('N0-0');
  const [target, setTarget] = useState('N11-11');
  const [algorithm, setAlgorithm] = useState('dijkstra');
  const [metric, setMetric] = useState('distance');
  const [speed, setSpeed] = useState(1);
  const [picking, setPicking] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [fetchState, setFetchState] = useState({ status: 'idle', error: null });
  const [compare, setCompare] = useState({ status: 'idle', data: null, error: null });
  const [, bump] = useReducer((n) => n + 1, 0);
  const entry = useRef(null);   // { key, run, player }
  const latest = useRef(0);
  const emptyState = useMemo(() => createLabState(), []);

  const paramsKey = `${size}|${source}|${target}|${algorithm}|${metric}`;

  // Load the lab graph when the size changes.
  useEffect(() => {
    let cancelled = false;
    setGraphState({ status: 'loading', graph: null, error: null });
    getLabGraph(size, size)
      .then((graph) => {
        if (cancelled) return;
        setGraphState({ status: 'ok', graph, error: null });
        setSource('N0-0');
        setTarget(`N${size - 1}-${size - 1}`);
      })
      .catch((err) => { if (!cancelled) setGraphState({ status: 'error', graph: null, error: err.message }); });
    return () => { cancelled = true; };
  }, [size, reloadTick]);

  // Any parameter change invalidates the recorded run.
  useEffect(() => {
    latest.current += 1;
    entry.current?.player.dispose();
    entry.current = null;
    setFetchState({ status: 'idle', error: null });
    setCompare({ status: 'idle', data: null, error: null });
  }, [paramsKey]);

  useEffect(() => () => entry.current?.player.dispose(), []);

  const payload = { rows: size, cols: size, source, destination: target, metric };

  async function ensureRun() {
    if (entry.current && entry.current.key === paramsKey) return entry.current;
    const id = ++latest.current;
    setFetchState({ status: 'loading', error: null });
    try {
      const run = await runLab({ ...payload, algorithm });
      if (id !== latest.current) return null;
      const player = new LabPlayer(run.events, { onChange: bump });
      player.setSpeed(speed);
      entry.current = { key: paramsKey, run, player };
      setFetchState({ status: 'ready', error: null });
      return entry.current;
    } catch (err) {
      if (id === latest.current) setFetchState({ status: 'error', error: err.message });
      return null;
    }
  }

  const act = {
    start: async () => {
      const e = await ensureRun();
      if (reduceMotion) e?.player.startFinished(); else e?.player.start();
    },
    pause: () => entry.current?.player.pause(),
    resume: () => entry.current?.player.resume(),
    step: async () => { (await ensureRun())?.player.stepForward(); },
    reset: () => entry.current?.player.reset(),
  };

  function changeSpeed(value) {
    setSpeed(value);
    entry.current?.player.setSpeed(value);
  }

  async function runCompare() {
    setCompare({ status: 'loading', data: null, error: null });
    try {
      const data = await compareLab(payload);
      setCompare({ status: 'ok', data, error: null });
    } catch (err) {
      setCompare({ status: 'error', data: null, error: err.message });
    }
  }

  function pickVertex(id) {
    if (picking === 'source') setSource(id); else if (picking === 'target') setTarget(id);
    setPicking(null);
  }

  const player = entry.current?.player ?? null;
  const state = player?.state ?? emptyState;
  const status = player?.status ?? 'idle';
  const loadingRun = fetchState.status === 'loading';
  const graph = graphState.graph;
  const vertexIds = graph ? graph.vertices.map((v) => v.id) : [];

  return (
    <div className="flex flex-col gap-6">
      <p className="border border-secondary px-3 py-2 font-mono text-xs text-body">
        <Badge tone="magenta" className="mr-2">Synthetic grid</Badge>
        The lab runs on a generated grid (not real roads) so the search is easy to see. The algorithms are the real backend engine; the animation replays the events it recorded.
      </p>
      {reduceMotion && (
        <p role="note" className="border border-cyan px-3 py-2 font-mono text-xs text-body">
          Reduced motion is on: Start shows the finished run at once. Use Step Forward to go through it one expansion at a time. Change this in Settings.
        </p>
      )}

      {graphState.status === 'loading' && <LoadingIndicator label="Loading lab graph" />}
      {graphState.status === 'error' && <ErrorState title="Cannot load the lab graph" message={graphState.error} onRetry={() => setReloadTick((t) => t + 1)} />}

      {graph && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="flex flex-col gap-4 xl:col-span-2">
            <Card meta="Visualisation" title={`${algorithm === 'astar' ? 'A*' : 'Dijkstra'} on a ${size}×${size} grid`} actions={<Badge tone={status === 'playing' ? 'green' : 'neutral'}>{STATUS_TEXT[status]}</Badge>}>
              <GraphCanvas
                graph={graph}
                state={state}
                source={source}
                target={target}
                picking={picking !== null}
                onPick={pickVertex}
                label={`Search graph: ${state.counters.nodesVisited} nodes visited, ${state.counters.edgesExplored} edges explored${state.found ? ', path found' : ''}`}
                className={picking ? 'cursor-pointer' : ''}
              />
              <div className="mt-4"><LabLegend /></div>
            </Card>

            <Card meta="Step log" title="What the engine just did">
              <ol aria-live={status === 'playing' ? 'off' : 'polite'} className="flex min-h-[6rem] flex-col gap-1 font-mono text-xs text-body">
                {player && player.lastStepEvents.length > 0
                  ? player.lastStepEvents.slice(0, 14).map((e) => <li key={e.seq}>{describeEvent(e, metric)}</li>)
                  : <li className="text-muted">Press Start or Step Forward. Each step is one expansion: the engine takes the best node from the priority queue, explores its edges and updates costs.</li>}
                {player && player.lastStepEvents.length > 14 && <li className="text-muted">… and {player.lastStepEvents.length - 14} more events in this step</li>}
              </ol>
            </Card>
          </div>

          <div className="flex flex-col gap-6">
            <Card meta="Setup" title="Algorithm and route">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="lab-algo" className="nx-label">Algorithm</label>
                    <select id="lab-algo" value={algorithm} onChange={(e) => setAlgorithm(e.target.value)} className={selectClass}>
                      <option value="dijkstra">Dijkstra</option>
                      <option value="astar">A*</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="lab-metric" className="nx-label">Optimise</label>
                    <select id="lab-metric" value={metric} onChange={(e) => setMetric(e.target.value)} className={selectClass}>
                      <option value="distance">Distance</option>
                      <option value="time">Est. time</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="lab-source" className="nx-label">Start</label>
                    <select id="lab-source" value={source} onChange={(e) => setSource(e.target.value)} className={selectClass}>
                      {vertexIds.map((id) => <option key={id} value={id}>{id}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="lab-target" className="nx-label">Destination</label>
                    <select id="lab-target" value={target} onChange={(e) => setTarget(e.target.value)} className={selectClass}>
                      {vertexIds.map((id) => <option key={id} value={id}>{id}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="lab-size" className="nx-label">Grid size</label>
                    <select id="lab-size" value={size} onChange={(e) => setSize(Number(e.target.value))} className={selectClass}>
                      {SIZES.map((n) => <option key={n} value={n}>{n}×{n}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="lab-speed" className="nx-label">Speed</label>
                    <select id="lab-speed" value={speed} onChange={(e) => changeSpeed(Number(e.target.value))} className={selectClass}>
                      {SPEEDS.map((x) => <option key={x} value={x}>{x}×</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant={picking === 'source' ? 'primary' : 'ghost'} onClick={() => setPicking(picking === 'source' ? null : 'source')}>{picking === 'source' ? 'Click a node…' : 'Pick start'}</Button>
                  <Button size="sm" variant={picking === 'target' ? 'primary' : 'ghost'} onClick={() => setPicking(picking === 'target' ? null : 'target')}>{picking === 'target' ? 'Click a node…' : 'Pick destination'}</Button>
                </div>
              </div>
            </Card>

            <Card meta="Controls" title="Execution">
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={act.start} loading={loadingRun}>Start</Button>
                <Button variant="secondary" onClick={act.pause} disabled={status !== 'playing'}>Pause</Button>
                <Button variant="secondary" onClick={act.resume} disabled={status !== 'paused'}>Resume</Button>
                <Button variant="secondary" onClick={act.step} disabled={loadingRun || status === 'done'}>Step forward</Button>
                <Button variant="ghost" onClick={act.reset} disabled={!player || status === 'idle'} className="col-span-2">Reset</Button>
              </div>
              {fetchState.status === 'error' && <p role="alert" className="mt-3 font-mono text-xs text-secondary">{fetchState.error}</p>}
              <p className="mt-3 font-mono text-[0.6875rem] text-muted">
                The algorithm has already finished on the server when playback starts. Pause, resume and step only control how its recorded events are shown.
              </p>
            </Card>

            <LabMetrics state={state} run={entry.current?.run ?? null} metric={metric} />
          </div>
        </div>
      )}

      {graph && (
        <section aria-label="Algorithm comparison" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={runCompare} loading={compare.status === 'loading'}>Compare Dijkstra vs A*</Button>
            <p className="font-mono text-xs text-muted">Runs both algorithms on this grid with the current start, destination and optimisation.</p>
          </div>
          {compare.status === 'error' && <ErrorState title="Comparison failed" message={compare.error} onRetry={runCompare} />}
          {compare.status === 'ok' && <CompareView graph={graph} data={compare.data} source={source} target={target} />}
          <p className="font-mono text-xs text-muted">Execution time depends on hardware, graph size and runtime conditions. On small graphs it is tiny and noisy, so node counts show search behaviour more reliably.</p>
        </section>
      )}
    </div>
  );
}
