import { Link, useLocation } from 'react-router-dom';
import ControlConsole from '../components/landing/ControlConsole.jsx';
import StatusIndicator from '../components/layout/StatusIndicator.jsx';
import { useHealth } from '../hooks/useHealth.js';
import { useSession } from '../context/SessionContext.jsx';

const CAPABILITIES = [
  { name: 'Route Planner', text: 'Search two places or click the map. Both points snap to the nearest road, and NEXORA calculates the shortest or fastest drivable route with Dijkstra or A*.' },
  { name: 'Algorithm Lab', text: 'Replay a recorded run of either algorithm on a practice grid: the queue, the nodes it settles, the edges it relaxes. Compare Dijkstra and A* on the same trip.' },
  { name: 'Saved routes and history', text: 'Save the routes you reuse and reopen them in one click. Every calculation is logged with its places, algorithm, distance and estimated time.' },
  { name: 'Analytics', text: 'See how many routes you have calculated, the average distance, the destinations you search most and how long each algorithm took, all computed from your own history.' },
];

const STEPS = [
  { name: 'Request control', text: 'NEXORA creates an anonymous workspace on its server and remembers the workspace key in this browser.' },
  { name: 'Work', text: 'Saved routes, history and analytics belong to that workspace. Appearance, map and unit settings stay on this device.' },
  { name: 'Release', text: 'Release control at any time. Keep the data and resume later, or erase it permanently.' },
];

export default function Landing() {
  const health = useHealth();
  const { holdsControl } = useSession();
  const reason = useLocation().state?.reason;

  return (
    <div className="nx-scanlines min-h-screen bg-bg">
      <a href="#landing-main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[70] focus:bg-primary focus:px-3 focus:py-2 focus:text-bg">Skip to content</a>

      <header className="mx-auto flex h-header max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="h-6 w-1.5 bg-primary" aria-hidden="true" />
          <div>
            <p className="text-lg font-semibold leading-none tracking-wide text-ink">NEXORA</p>
            <p className="nx-label mt-1">Route Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusIndicator status={health.status} />
          {holdsControl && <Link to="/app" className="inline-flex h-10 items-center border border-control px-4 font-mono text-xs uppercase tracking-[0.12em] text-primary hover:border-primary hover:bg-primary/10">Open workspace</Link>}
        </div>
      </header>

      <main id="landing-main" tabIndex={-1} className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <section className="grid gap-10 py-10 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-16">
          <div className="max-w-xl">
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">Plan the route. Watch the algorithm decide.</h1>
            <p className="mt-6 text-lg text-body">
              NEXORA finds routes across real OpenStreetMap roads with Dijkstra and A*, then lets you replay how each algorithm searched, so you can see why it chose that path.
            </p>
            <p className="mt-4 font-mono text-xs text-muted">
              Travel time uses assumed road speeds, not live traffic. Without downloaded OpenStreetMap data the app uses a clearly labelled synthetic sample grid.
            </p>
            <p className="mt-8"><a href="#how-control-works" className="font-mono text-sm text-primary underline decoration-control underline-offset-4 hover:text-ink">How control works</a></p>
          </div>
          <ControlConsole reason={reason} />
        </section>

        <section aria-labelledby="capabilities-title" className="grid gap-8 border-t border-border py-12 lg:grid-cols-[1fr_2fr]">
          <h2 id="capabilities-title" className="text-2xl font-semibold tracking-tight">What you can do with it</h2>
          <dl className="flex flex-col">
            {CAPABILITIES.map((c) => (
              <div key={c.name} className="grid gap-1 border-b border-border py-4 first:pt-0 last:border-b-0 sm:grid-cols-[12rem_1fr] sm:gap-6">
                <dt className="font-semibold text-ink">{c.name}</dt>
                <dd className="text-body">{c.text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="how-control-works" aria-labelledby="control-title" className="grid scroll-mt-6 gap-8 border-t border-border py-12 lg:grid-cols-[1fr_2fr]">
          <div>
            <h2 id="control-title" className="text-2xl font-semibold tracking-tight">How control works</h2>
            <p className="mt-3 text-body">It behaves like signing in, without accounts.</p>
          </div>
          <div className="flex flex-col gap-6">
            <ol className="flex flex-col">
              {STEPS.map((s, i) => (
                <li key={s.name} className="grid grid-cols-[2.5rem_1fr] gap-3 border-b border-border py-4 first:pt-0">
                  <span className="font-mono text-sm text-primary" aria-hidden="true">{i + 1}</span>
                  <div><h3 className="font-semibold text-ink">{s.name}</h3><p className="mt-1 text-body">{s.text}</p></div>
                </li>
              ))}
            </ol>
            <p role="note" className="border border-secondary px-4 py-3 text-sm text-body">
              <strong className="text-ink">Not authentication.</strong> Anyone who holds your workspace key can open your workspace, and there is no password to reset. Do not save anything sensitive in saved routes or names.
            </p>
          </div>
        </section>

        <section aria-labelledby="cta-title" className="flex flex-col items-start gap-4 border-t border-border py-12 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="cta-title" className="text-2xl font-semibold tracking-tight">Ready to plan your first route?</h2>
          <a href="#control-console" className="inline-flex h-12 items-center border border-primary bg-primary px-6 font-mono text-sm font-medium uppercase tracking-[0.12em] text-bg hover:border-ink hover:bg-ink">Go to the control console</a>
        </section>
      </main>

      <footer className="border-t border-border">
        <p className="mx-auto max-w-7xl px-4 py-4 font-mono text-xs text-muted sm:px-6">NEXORA v0.6.0 · Pure JavaScript · Map data from OpenStreetMap contributors</p>
      </footer>
    </div>
  );
}
