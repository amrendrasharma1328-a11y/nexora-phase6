import { useMemo } from 'react';
import { projectVertices } from '../../lab/geometry.js';
import { edgeKey } from '../../lab/labState.js';
import { useSettings } from '../../context/SettingsContext.jsx';

function edgeStyle(C, state, a, b) {
  const keys = [edgeKey(a, b), edgeKey(b, a)];
  if (keys.some((k) => state.pathEdgeKeys.has(k))) return { stroke: C.secondary, width: 4, opacity: 1 };
  const kinds = keys.map((k) => state.exploredEdges.get(k));
  if (kinds.includes('relaxed')) return { stroke: C.cyan, width: 2, opacity: 0.85 };
  if (kinds.includes('explored')) return { stroke: C.primary, width: 1.75, opacity: 0.55 };
  return { stroke: C.border, width: 1, opacity: 1 };
}

function nodeStyle(C, state, id) {
  if (state.current === id) return { fill: C.ink, stroke: C.primary, strokeWidth: 3, scale: 1.6 };
  if (state.visited.has(id)) return { fill: C.primary, fillOpacity: 0.55, stroke: C.primary, strokeWidth: 1, scale: 1 };
  if (state.frontier.has(id)) return { fill: C.bg, stroke: C.cyan, strokeWidth: 2, scale: 1.15 };
  return { fill: C.bg, stroke: C.control, strokeWidth: 1, scale: 1 };
}

/**
 * SVG rendering of the lab graph. Visual state comes only from `state` (derived from real engine events).
 * @param {{graph: {vertices: object[], edges: object[]}, state: object, source: string, target: string,
 *   picking?: boolean, onPick?: (id: string) => void, label: string, className?: string}} props
 */
export default function GraphCanvas({ graph, state, source, target, picking = false, onPick = () => {}, label, className = '' }) {
  const { palette: C } = useSettings(); // follows the active theme
  const layout = useMemo(() => projectVertices(graph.vertices), [graph]);
  const { positions, width, height } = layout;
  const size = useMemo(() => {
    const spacing = Math.sqrt(((width - 60) * (height - 60)) / Math.max(1, graph.vertices.length));
    return Math.max(3, Math.min(9, spacing * 0.2));
  }, [width, height, graph.vertices.length]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className={`w-full border border-border bg-bg ${className}`}>
      <title>{label}</title>
      <g>
        {graph.edges.map((e) => {
          const p = positions.get(e.from); const q = positions.get(e.to);
          if (!p || !q) return null;
          const st = edgeStyle(C, state, e.from, e.to);
          return <line key={`${e.from}-${e.to}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={st.stroke} strokeWidth={st.width} strokeOpacity={st.opacity} />;
        })}
      </g>
      <g>
        {graph.edges.filter((e) => e.oneWay).map((e) => {
          const p = positions.get(e.from); const q = positions.get(e.to);
          if (!p || !q) return null;
          const dx = q.x - p.x; const dy = q.y - p.y; const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len; const uy = dy / len;
          const mx = (p.x + q.x) / 2; const my = (p.y + q.y) / 2; const a = size * 0.9;
          const pts = `${mx + ux * a},${my + uy * a} ${mx - ux * a - uy * a * 0.8},${my - uy * a + ux * a * 0.8} ${mx - ux * a + uy * a * 0.8},${my - uy * a - ux * a * 0.8}`;
          return <polygon key={`ow-${e.from}-${e.to}`} points={pts} fill={C.control} />;
        })}
      </g>
      <g>
        {graph.vertices.map((v) => {
          const p = positions.get(v.id);
          const st = nodeStyle(C, state, v.id);
          const s = size * st.scale;
          return (
            <g key={v.id}>
              <rect x={p.x - s} y={p.y - s} width={s * 2} height={s * 2} fill={st.fill} fillOpacity={st.fillOpacity ?? 1} stroke={st.stroke} strokeWidth={st.strokeWidth} />
              {picking && <rect x={p.x - size * 1.6} y={p.y - size * 1.6} width={size * 3.2} height={size * 3.2} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => onPick(v.id)}><title>{v.id}</title></rect>}
            </g>
          );
        })}
      </g>
      {[[source, 'S'], [target, 'D']].map(([id, letter]) => {
        const p = positions.get(id);
        if (!p) return null;
        return (
          <g key={letter} pointerEvents="none">
            <rect x={p.x - size * 1.9} y={p.y - size * 1.9} width={size * 3.8} height={size * 3.8} fill="none" stroke={C.secondary} strokeWidth="2.5" />
            <text x={p.x + size * 2.2} y={p.y - size * 1.6} fill={C.secondary} fontFamily="'IBM Plex Mono', monospace" fontSize={Math.max(12, size * 2.6)} fontWeight="600">{letter}</text>
          </g>
        );
      })}
    </svg>
  );
}
