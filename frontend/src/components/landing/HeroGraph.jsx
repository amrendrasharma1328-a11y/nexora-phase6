/**
 * Decorative road-graph illustration for the landing page. Static data: it illustrates the idea of a search
 * (explored nodes in green, the chosen route in magenta) and is not output from the engine.
 * The route draws itself once; with reduced motion it simply appears.
 */
const COLS = 7;
const ROWS = 4;
const X0 = 40; const Y0 = 36; const DX = 80; const DY = 62;
const node = (c, r) => ({ x: X0 + c * DX, y: Y0 + r * DY });

// Grid edges, minus a few "closed" roads so the picture reads as a street network.
const MISSING = new Set(['2-1>3-1', '4-2>4-3', '1-0>1-1', '5-1>5-2']);
const edges = [];
for (let r = 0; r < ROWS; r += 1) {
  for (let c = 0; c < COLS; c += 1) {
    if (c + 1 < COLS && !MISSING.has(`${c}-${r}>${c + 1}-${r}`)) edges.push([node(c, r), node(c + 1, r)]);
    if (r + 1 < ROWS && !MISSING.has(`${c}-${r}>${c}-${r + 1}`)) edges.push([node(c, r), node(c, r + 1)]);
  }
}

const ROUTE = [[0, 3], [1, 3], [1, 2], [2, 2], [3, 2], [3, 1], [4, 1], [5, 1], [6, 1], [6, 0]];
const EXPLORED = [[0, 2], [1, 1], [2, 1], [2, 3], [3, 3], [2, 0], [3, 0], [4, 0], [4, 2], [5, 0], [5, 2]];
const path = ROUTE.map(([c, r]) => node(c, r));
const d = path.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');

export default function HeroGraph() {
  const start = path[0]; const end = path[path.length - 1];
  return (
    <svg viewBox="0 0 560 250" role="img" aria-label="Illustration: a route found across a small road network, with the nodes the search explored shown in green and the chosen route in magenta" className="h-auto w-full border border-border bg-bg">
      <g className="stroke-border" strokeWidth="1.5">
        {edges.map(([a, b], i) => <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />)}
      </g>
      <g>
        {Array.from({ length: COLS * ROWS }, (_, i) => node(i % COLS, Math.floor(i / COLS))).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" className="fill-bg stroke-control" strokeWidth="1.5" />
        ))}
      </g>
      <g className="nx-reveal">
        {EXPLORED.map(([c, r]) => {
          const p = node(c, r);
          return <circle key={`${c}-${r}`} cx={p.x} cy={p.y} r="5.5" className="fill-primary/30 stroke-primary" strokeWidth="1.5" />;
        })}
      </g>
      <path d={d} pathLength="1" fill="none" className="nx-draw stroke-secondary" strokeWidth="4" strokeLinecap="square" strokeLinejoin="miter" />
      <g className="font-mono" fontSize="12" fontWeight="600">
        <rect x={start.x - 14} y={start.y - 14} width="28" height="28" className="fill-primary" />
        <text x={start.x} y={start.y + 4.5} textAnchor="middle" className="fill-bg">S</text>
        <rect x={end.x - 14} y={end.y - 14} width="28" height="28" className="fill-secondary" />
        <text x={end.x} y={end.y + 4.5} textAnchor="middle" className="fill-bg">D</text>
      </g>
    </svg>
  );
}
