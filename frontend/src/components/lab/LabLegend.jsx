import { useSettings } from '../../context/SettingsContext.jsx';
const swatch = (props) => (
  <svg width="22" height="14" aria-hidden="true" focusable="false">{props}</svg>
);
const items = (C) => [
  ['Start (S) / destination (D)', swatch(<rect x="4" y="1" width="12" height="12" fill="none" stroke={C.secondary} strokeWidth="2" />)],
  ['Unvisited node', swatch(<rect x="5" y="2" width="10" height="10" fill={C.bg} stroke={C.control} />)],
  ['In priority queue (frontier)', swatch(<rect x="5" y="2" width="10" height="10" fill={C.bg} stroke={C.cyan} strokeWidth="2" />)],
  ['Visited (expanded)', swatch(<rect x="5" y="2" width="10" height="10" fill={C.primary} fillOpacity="0.55" stroke={C.primary} />)],
  ['Current node', swatch(<rect x="3" y="0" width="14" height="14" fill={C.ink} stroke={C.primary} strokeWidth="3" />)],
  ['Edge explored', swatch(<line x1="0" y1="7" x2="22" y2="7" stroke={C.primary} strokeOpacity="0.55" strokeWidth="2" />)],
  ['Better cost found (relaxed)', swatch(<line x1="0" y1="7" x2="22" y2="7" stroke={C.cyan} strokeWidth="2" />)],
  ['Final shortest path', swatch(<line x1="0" y1="7" x2="22" y2="7" stroke={C.secondary} strokeWidth="4" />)],
  ['One-way road (arrow points the allowed way)', swatch(<polygon points="16,7 6,2 6,12" fill={C.control} />)],
];

/** Visual legend for the lab graph. */
export default function LabLegend() {
  const { palette: C } = useSettings();
  const ITEMS = items(C);
  return (
    <ul aria-label="Legend" className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
      {ITEMS.map(([text, icon]) => (
        <li key={text} className="flex items-center gap-2 font-mono text-xs text-body">{icon}{text}</li>
      ))}
    </ul>
  );
}
