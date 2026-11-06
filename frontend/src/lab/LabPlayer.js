import { applyEvent, createLabState } from './labState.js';

/**
 * Split an event list into "expansion steps". A step starts at each non-stale queue extraction
 * (the engine picking the next node) and runs until the next one. The first step holds the
 * start/initial-queue events. Step Forward and playback advance one step at a time.
 * @returns {number[]} start index of every step
 */
export function groupStarts(events) {
  const starts = events.length ? [0] : [];
  for (let i = 1; i < events.length; i += 1) {
    if (events[i].type === 'queue_pop' && !events[i].stale) starts.push(i);
  }
  return starts;
}

/**
 * Plays back a recorded list of REAL engine events. Playback (timing, pause, step) is completely
 * separate from algorithm execution: the algorithm already finished on the server.
 *
 * status: 'idle' | 'playing' | 'paused' | 'done'
 */
export class LabPlayer {
  /**
   * @param {object[]} events
   * @param {{baseIntervalMs?: number, setTimer?: Function, clearTimer?: Function, onChange?: () => void}} [options]
   */
  constructor(events, { baseIntervalMs = 300, setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (id) => clearTimeout(id), onChange = () => {} } = {}) {
    this.events = events;
    this.starts = groupStarts(events);
    this.baseIntervalMs = baseIntervalMs;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.onChange = onChange;
    this.speed = 1;
    this.version = 0;
    this.timer = null;
    this.rebuild();
  }

  rebuild() {
    this.state = createLabState();
    this.stepIndex = 0;       // number of steps applied
    this.eventCursor = 0;     // number of events applied
    this.lastStepEvents = [];
    this.status = 'idle';
  }

  get totalSteps() { return this.starts.length; }
  get isDone() { return this.stepIndex >= this.starts.length; }

  notify() { this.version += 1; this.onChange(); }

  /** Apply the next expansion step. @returns {boolean} true if a step was applied */
  applyNextStep() {
    if (this.isDone) return false;
    const from = this.starts[this.stepIndex];
    const to = this.stepIndex + 1 < this.starts.length ? this.starts[this.stepIndex + 1] : this.events.length;
    this.lastStepEvents = this.events.slice(from, to);
    for (const e of this.lastStepEvents) applyEvent(this.state, e);
    this.eventCursor = to;
    this.stepIndex += 1;
    if (this.isDone) { this.stopTimer(); this.status = 'done'; }
    return true;
  }

  stopTimer() {
    if (this.timer !== null) { this.clearTimer(this.timer); this.timer = null; }
  }

  schedule() {
    this.stopTimer();
    this.timer = this.setTimer(() => {
      this.timer = null;
      if (this.status !== 'playing') return;
      this.applyNextStep();
      if (this.status === 'playing') this.schedule();
      this.notify();
    }, this.baseIntervalMs / this.speed);
  }

  /** Start from the beginning. */
  start() {
    this.stopTimer();
    this.rebuild();
    if (this.isDone) { this.notify(); return; }
    this.status = 'playing';
    this.schedule();
    this.notify();
  }

  /** Start from the beginning and apply every step at once (used when motion is reduced). */
  startFinished() {
    this.start();
    this.stopTimer();
    while (!this.isDone) this.applyNextStep();
    this.status = 'done';
    this.notify();
  }

  pause() {
    if (this.status !== 'playing') return;
    this.stopTimer();
    this.status = 'paused';
    this.notify();
  }

  resume() {
    if (this.status !== 'paused' || this.isDone) return;
    this.status = 'playing';
    this.schedule();
    this.notify();
  }

  /** Advance exactly one expansion step (pauses playback if it was running). */
  stepForward() {
    if (this.isDone) return;
    this.stopTimer();
    this.applyNextStep();
    if (this.status !== 'done') this.status = 'paused';
    this.notify();
  }

  reset() {
    this.stopTimer();
    this.rebuild();
    this.notify();
  }

  /** @param {number} multiplier e.g. 0.5, 1, 2, 5, 10 */
  setSpeed(multiplier) {
    if (!(multiplier > 0)) return;
    this.speed = multiplier;
    if (this.status === 'playing') this.schedule();
    this.notify();
  }

  dispose() { this.stopTimer(); }
}
