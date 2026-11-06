/**
 * Strongly connected components (iterative Tarjan, safe for very large graphs).
 * @param {Map<string, string[]>} adjacency vertex -> outgoing neighbour ids
 * @returns {string[][]} components
 */
export function stronglyConnectedComponents(adjacency) {
  const index = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const components = [];
  let counter = 0;

  for (const root of adjacency.keys()) {
    if (index.has(root)) continue;
    const work = [{ v: root, i: 0 }];
    index.set(root, counter); low.set(root, counter); counter += 1;
    stack.push(root); onStack.add(root);

    while (work.length) {
      const frame = work[work.length - 1];
      const neighbours = adjacency.get(frame.v) ?? [];
      if (frame.i < neighbours.length) {
        const w = neighbours[frame.i];
        frame.i += 1;
        if (!adjacency.has(w)) continue;
        if (!index.has(w)) {
          index.set(w, counter); low.set(w, counter); counter += 1;
          stack.push(w); onStack.add(w);
          work.push({ v: w, i: 0 });
        } else if (onStack.has(w)) {
          low.set(frame.v, Math.min(low.get(frame.v), index.get(w)));
        }
      } else {
        if (low.get(frame.v) === index.get(frame.v)) {
          const comp = [];
          let w;
          do { w = stack.pop(); onStack.delete(w); comp.push(w); } while (w !== frame.v);
          components.push(comp);
        }
        work.pop();
        if (work.length) {
          const parent = work[work.length - 1].v;
          low.set(parent, Math.min(low.get(parent), low.get(frame.v)));
        }
      }
    }
  }
  return components;
}

/** @returns {string[]} the largest strongly connected component (empty array for an empty graph) */
export function largestComponent(adjacency) {
  let best = [];
  for (const c of stronglyConnectedComponents(adjacency)) if (c.length > best.length) best = c;
  return best;
}
