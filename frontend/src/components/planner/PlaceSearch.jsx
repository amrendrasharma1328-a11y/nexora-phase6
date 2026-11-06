import { useId, useState } from 'react';
import Button from '../ui/Button.jsx';
import LoadingIndicator from '../ui/LoadingIndicator.jsx';
import { searchPlaces } from '../../api/client.js';

/**
 * Place search for one end of the route. Searches ONLY when the form is submitted
 * (the public geocoder's policy forbids search-as-you-type).
 * @param {{label: string, point: {label: string, lat: number, lng: number}|null,
 *   onSelect: (p: {label: string, lat: number, lng: number}) => void, initialQuery?: string}} props
 */
export default function PlaceSearch({ label, point, onSelect, initialQuery = '' }) {
  const id = useId();
  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState({ status: 'idle', results: [], error: null });

  async function submit(e) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) { setState({ status: 'error', results: [], error: 'Enter at least 2 characters' }); return; }
    setState({ status: 'loading', results: [], error: null });
    try {
      const data = await searchPlaces(q);
      setState({ status: 'done', results: data.results, error: null });
    } catch (err) {
      setState({ status: 'error', results: [], error: err.message });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={submit} className="flex flex-col gap-1.5">
        <label htmlFor={id} className="nx-label">{label}</label>
        <div className="flex gap-2">
          <input id={id} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a place or road" className="h-10 min-w-0 flex-1 border border-control bg-bg px-3 font-mono text-sm text-ink placeholder:text-muted/60 hover:border-primary" />
          <Button type="submit" variant="secondary" loading={state.status === 'loading'}>Search</Button>
        </div>
      </form>

      {point && (
        <p className="font-mono text-xs text-ink">
          <span className="nx-label mr-2">Selected</span>{point.label}
          <span className="ml-2 text-muted">({point.lat.toFixed(5)}, {point.lng.toFixed(5)})</span>
        </p>
      )}
      {state.status === 'loading' && <LoadingIndicator label="Searching" />}
      {state.status === 'error' && <p role="alert" className="font-mono text-xs text-secondary">{state.error}</p>}
      {state.status === 'done' && state.results.length === 0 && <p className="font-mono text-xs text-muted">No places found inside the configured region.</p>}
      {state.results.length > 0 && (
        <ul className="max-h-48 overflow-y-auto border border-border">
          {state.results.map((r, i) => (
            <li key={`${r.osmType}-${r.osmId}-${i}`} className="border-b border-border/50 last:border-b-0">
              <button
                type="button"
                onClick={() => { onSelect({ label: r.displayName, lat: r.lat, lng: r.lng }); setState({ status: 'idle', results: [], error: null }); }}
                className="block w-full px-3 py-2 text-left font-mono text-xs text-body hover:bg-primary/10 hover:text-ink"
              >
                {r.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
