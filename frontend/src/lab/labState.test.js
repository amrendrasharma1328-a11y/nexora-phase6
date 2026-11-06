import { describe, it, expect } from 'vitest';
import { applyEvent, createLabState, replayAll, describeEvent, edgeKey } from './labState.js';
import { LabPlayer, groupStarts } from './LabPlayer.js';
import { projectVertices } from './geometry.js';
// Integration: feed REAL events from the backend engine into the frontend player.
import { dijkstra } from '../../../backend/src/engine/dijkstra.js';
import { aStar } from '../../../backend/src/engine/astar.js';
import { createSampleGraph } from '../../../backend/src/data/sampleGraph.js';

const record = (fn, graph, s, t, opts = {}) => {
  const events = [];
  const result = fn(graph, s, t, { ...opts, onEvent: (e) => events.push(e) });
  return { events, result };
};

/** Fake timers so tests control time deterministically. */
function fakeTimers() {
  let next = 1; const pending = new Map();
  return {
    setTimer: (fn, ms) => { const id = next++; pending.set(id, { fn, ms }); return id; },
    clearTimer: (id) => { pending.delete(id); },
    pendingCount: () => pending.size,
    lastDelay: () => [...pending.values()].pop()?.ms,
    tick: () => { const [id, t] = [...pending.entries()][0] ?? []; if (!t) return false; pending.delete(id); t.fn(); return true; },
  };
}

describe('labState (consumes real events)', () => {
  for (const [name, fn] of [['Dijkstra', dijkstra], ['A*', aStar]]) {
    it(`${name}: replaying all events reproduces the engine's result and counters`, () => {
      const g = createSampleGraph();
      const { events, result } = record(fn, g, 'N0-0', 'N5-5');
      const s = replayAll(events);
      expect(s.done).toBe(true);
      expect(s.found).toBe(true);
      expect(s.path).toEqual(result.path);
      expect(s.cost).toBeCloseTo(result.cost, 9);
      expect(s.counters.nodesVisited).toBe(result.stats.nodesVisited);
      expect(s.counters.edgesExplored).toBe(result.stats.edgesExplored);
      expect(s.counters.queuePushes).toBe(result.stats.heapInserts);
      expect(s.counters.queuePops).toBe(result.stats.heapExtractions);
      expect([...s.visited.keys()]).toEqual(result.visitedNodes);
      expect(s.pathEdgeKeys.size).toBe(result.path.length - 1);
      expect(s.pathEdgeKeys.has(edgeKey(result.path[0], result.path[1]))).toBe(true);
    });

    it(`${name}: unreachable destination ends with found=false`, () => {
      const { events } = record(fn, createSampleGraph(), 'N0-0', 'X1');
      const s = replayAll(events);
      expect(s.done).toBe(true);
      expect(s.found).toBe(false);
      expect(s.path).toEqual([]);
    });
  }

  it('frontier only holds nodes still waiting in the queue; visited nodes leave it', () => {
    const { events } = record(dijkstra, createSampleGraph(), 'N0-0', 'N5-5');
    const s = replayAll(events);
    for (const node of s.visited.keys()) if (node !== 'N5-5') expect(s.frontier.has(node)).toBe(false);
    expect(s.counters.queuePushes - s.counters.queuePops).toBe(s.queueSize);
  });

  it('ignores unknown event types and describes events readably', () => {
    const s = createLabState();
    applyEvent(s, { type: 'something_new' });
    expect(s.counters.nodesVisited).toBe(0);
    expect(describeEvent({ type: 'node_visited', node: 'N1-1', cost: 12.34, order: 1 })).toContain('N1-1');
    expect(describeEvent({ type: 'no_path', visitedCount: 3 }, 'time')).toContain('No path');
    expect(describeEvent({ type: 'distance_updated', node: 'B', via: 'A', oldValue: null, newValue: 5 }, 'time')).toContain('first found');
  });
});

describe('groupStarts', () => {
  it('starts a new step at every non-stale queue_pop', () => {
    const ev = [{ type: 'start' }, { type: 'queue_push' }, { type: 'queue_pop', stale: false }, { type: 'node_visited' }, { type: 'queue_pop', stale: true }, { type: 'queue_pop', stale: false }];
    expect(groupStarts(ev)).toEqual([0, 2, 5]);
    expect(groupStarts([])).toEqual([]);
  });
});

describe('LabPlayer controls', () => {
  const g = createSampleGraph({ rows: 8, cols: 8, includeExtras: false });
  const { events, result } = record(dijkstra, g, 'N0-0', 'N7-7');

  it('Step Forward advances exactly one expansion step and pauses', () => {
    const p = new LabPlayer(events);
    expect(p.status).toBe('idle');
    p.stepForward();
    expect(p.stepIndex).toBe(1);
    expect(p.status).toBe('paused');
    expect(p.state.counters.nodesVisited).toBe(0); // first step is only the initial queue insert
    p.stepForward();
    expect(p.state.counters.nodesVisited).toBe(1);
    expect(p.state.current).toBe('N0-0');
  });

  it('Start plays on a timer; Pause stops it; Resume continues without losing progress', () => {
    const t = fakeTimers();
    const p = new LabPlayer(events, { setTimer: t.setTimer, clearTimer: t.clearTimer });
    p.start();
    expect(p.status).toBe('playing');
    t.tick(); t.tick(); t.tick();
    expect(p.stepIndex).toBe(3);
    p.pause();
    expect(p.status).toBe('paused');
    expect(t.pendingCount()).toBe(0);
    expect(t.tick()).toBe(false);
    const before = p.stepIndex;
    p.resume();
    expect(p.status).toBe('playing');
    t.tick();
    expect(p.stepIndex).toBe(before + 1);
  });

  it('plays to completion and ends with the engine\'s real result', () => {
    const t = fakeTimers();
    const p = new LabPlayer(events, { setTimer: t.setTimer, clearTimer: t.clearTimer });
    p.start();
    let guard = 0;
    while (t.tick() && guard++ < 10000) { /* run timers */ }
    expect(p.status).toBe('done');
    expect(p.state.path).toEqual(result.path);
    expect(p.state.counters.nodesVisited).toBe(result.stats.nodesVisited);
    expect(t.pendingCount()).toBe(0);
  });

  it('stepping one step at a time gives the same final state as playing', () => {
    const p = new LabPlayer(events);
    while (!p.isDone) p.stepForward();
    expect(p.status).toBe('done');
    const all = replayAll(events);
    expect(p.state.path).toEqual(all.path);
    expect(p.state.counters).toEqual(all.counters);
    expect(p.eventCursor).toBe(events.length);
  });

  it('Step Forward while playing pauses first and does not double-advance', () => {
    const t = fakeTimers();
    const p = new LabPlayer(events, { setTimer: t.setTimer, clearTimer: t.clearTimer });
    p.start();
    t.tick();
    p.stepForward();
    expect(p.status).toBe('paused');
    expect(p.stepIndex).toBe(2);
    expect(t.pendingCount()).toBe(0);
  });

  it('Reset returns to the initial state and stops playback; Start afterwards replays from scratch', () => {
    const t = fakeTimers();
    const p = new LabPlayer(events, { setTimer: t.setTimer, clearTimer: t.clearTimer });
    p.start(); t.tick(); t.tick();
    p.reset();
    expect(p.status).toBe('idle');
    expect(p.stepIndex).toBe(0);
    expect(p.state.visited.size).toBe(0);
    expect(t.pendingCount()).toBe(0);
    p.start();
    expect(p.status).toBe('playing');
    t.tick();
    expect(p.stepIndex).toBe(1);
  });

  it('Speed changes the timer delay, including while playing', () => {
    const t = fakeTimers();
    const p = new LabPlayer(events, { setTimer: t.setTimer, clearTimer: t.clearTimer, baseIntervalMs: 300 });
    p.start();
    expect(t.lastDelay()).toBe(300);
    p.setSpeed(10);
    expect(t.lastDelay()).toBe(30);
    expect(t.pendingCount()).toBe(1); // rescheduled, not duplicated
    p.setSpeed(0.5);
    expect(t.lastDelay()).toBe(600);
    p.setSpeed(-1);
    expect(p.speed).toBe(0.5);
  });

  it('Resume does nothing unless paused; Pause does nothing unless playing; controls are safe when done', () => {
    const p = new LabPlayer(events);
    p.resume(); p.pause();
    expect(p.status).toBe('idle');
    while (!p.isDone) p.stepForward();
    p.stepForward(); p.resume(); p.pause();
    expect(p.status).toBe('done');
  });

  it('notifies listeners and bumps the version on every control action', () => {
    let calls = 0;
    const p = new LabPlayer(events, { onChange: () => { calls += 1; } });
    p.stepForward(); p.setSpeed(2); p.reset();
    expect(calls).toBe(3);
    expect(p.version).toBe(3);
  });

  it('handles an empty event list', () => {
    const p = new LabPlayer([]);
    p.start();
    expect(p.isDone).toBe(true);
    p.stepForward();
    expect(p.state.visited.size).toBe(0);
  });
});

describe('projectVertices', () => {
  it('maps lat/lng into the padded SVG box with north up', () => {
    const { positions, width, height } = projectVertices([
      { id: 'a', lat: 10, lng: 20 }, { id: 'b', lat: 11, lng: 21 },
    ], { width: 1000, padding: 30 });
    expect(width).toBe(1000);
    expect(positions.get('a').y).toBeGreaterThan(positions.get('b').y); // higher latitude => smaller y
    expect(positions.get('a').x).toBeLessThan(positions.get('b').x);
    for (const p of positions.values()) {
      expect(p.x).toBeGreaterThanOrEqual(30);
      expect(p.x).toBeLessThanOrEqual(970);
      expect(p.y).toBeGreaterThanOrEqual(30);
      expect(p.y).toBeLessThanOrEqual(height - 30 + 1e-6);
    }
  });

  it('handles empty and single-vertex input', () => {
    expect(projectVertices([]).positions.size).toBe(0);
    expect(projectVertices([{ id: 'a', lat: 1, lng: 1 }]).positions.size).toBe(1);
  });
});

describe('LabPlayer.startFinished (reduced motion)', () => {
  it('jumps to the finished state without timers', async () => {
    const { LabPlayer } = await import('./LabPlayer.js');
    const timers = [];
    const player = new LabPlayer(
      [{ seq: 0, type: 'start', source: 'a', target: 'b' }, { seq: 1, type: 'visit', node: 'a' }, { seq: 2, type: 'visit', node: 'b' }, { seq: 3, type: 'done', found: true, path: ['a', 'b'], cost: 1 }],
      { setTimer: (fn) => { timers.push(fn); return timers.length; } },
    );
    player.startFinished();
    expect(player.status).toBe('done');
    expect(player.isDone).toBe(true);
  });
});
