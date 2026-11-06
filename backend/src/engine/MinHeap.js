/**
 * Custom binary min-heap (no external library).
 * Entries are ordered by priority; ties break by insertion order so results are deterministic.
 */
export class MinHeap {
  constructor() {
    /** @type {{value: any, priority: number, seq: number}[]} */
    this.heap = [];
    this.seq = 0;
    /** Operation counters, used for algorithm metrics. */
    this.insertCount = 0;
    this.extractCount = 0;
  }

  get size() {
    return this.heap.length;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  /** @returns {{value: any, priority: number}|null} smallest entry without removing it */
  peek() {
    if (this.heap.length === 0) return null;
    const { value, priority } = this.heap[0];
    return { value, priority };
  }

  /**
   * @param {any} value
   * @param {number} priority must be a non-NaN number
   */
  insert(value, priority) {
    if (typeof priority !== 'number' || Number.isNaN(priority)) {
      throw new TypeError('MinHeap priority must be a number');
    }
    this.heap.push({ value, priority, seq: this.seq++ });
    this.bubbleUp(this.heap.length - 1);
    this.insertCount += 1;
  }

  /** @returns {{value: any, priority: number}|null} removed smallest entry, or null if empty */
  extractMin() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    this.extractCount += 1;
    return { value: top.value, priority: top.priority };
  }

  /** @private */
  isLess(i, j) {
    const a = this.heap[i];
    const b = this.heap[j];
    return a.priority < b.priority || (a.priority === b.priority && a.seq < b.seq);
  }

  /** @private */
  swap(i, j) {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }

  /** Move the entry at `index` up until the heap property holds. */
  bubbleUp(index) {
    let i = index;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.isLess(i, parent)) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  /** Move the entry at `index` down until the heap property holds. */
  bubbleDown(index) {
    let i = index;
    const n = this.heap.length;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;
      if (left < n && this.isLess(left, smallest)) smallest = left;
      if (right < n && this.isLess(right, smallest)) smallest = right;
      if (smallest === i) break;
      this.swap(i, smallest);
      i = smallest;
    }
  }
}
