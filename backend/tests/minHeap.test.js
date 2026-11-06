import { describe, it, expect } from 'vitest';
import { MinHeap } from '../src/engine/MinHeap.js';
import { mulberry32 } from './helpers.js';

describe('MinHeap', () => {
  it('starts empty', () => {
    const h = new MinHeap();
    expect(h.isEmpty()).toBe(true);
    expect(h.size).toBe(0);
    expect(h.peek()).toBeNull();
    expect(h.extractMin()).toBeNull();
  });

  it('insert makes the heap non-empty and peek returns the minimum without removing it', () => {
    const h = new MinHeap();
    h.insert('c', 3);
    h.insert('a', 1);
    h.insert('b', 2);
    expect(h.isEmpty()).toBe(false);
    expect(h.peek()).toEqual({ value: 'a', priority: 1 });
    expect(h.size).toBe(3);
  });

  it('extractMin returns entries in ascending priority order', () => {
    const h = new MinHeap();
    [5, 3, 8, 1, 9, 2, 7].forEach((p) => h.insert(`v${p}`, p));
    const out = [];
    while (!h.isEmpty()) out.push(h.extractMin().priority);
    expect(out).toEqual([1, 2, 3, 5, 7, 8, 9]);
  });

  it('breaks ties by insertion order', () => {
    const h = new MinHeap();
    h.insert('first', 1);
    h.insert('second', 1);
    h.insert('third', 1);
    expect([h.extractMin().value, h.extractMin().value, h.extractMin().value]).toEqual(['first', 'second', 'third']);
  });

  it('handles negative, zero and fractional priorities', () => {
    const h = new MinHeap();
    [0, -2.5, 3.25, -2.5, 0.1].forEach((p, i) => h.insert(i, p));
    const out = [];
    while (!h.isEmpty()) out.push(h.extractMin().priority);
    expect(out).toEqual([-2.5, -2.5, 0, 0.1, 3.25]);
  });

  it('bubbleUp / bubbleDown keep the heap property under random operations', () => {
    const rnd = mulberry32(7);
    const h = new MinHeap();
    const mirror = [];
    for (let i = 0; i < 500; i += 1) {
      if (rnd() < 0.65 || mirror.length === 0) {
        const p = Math.floor(rnd() * 1000);
        h.insert(i, p);
        mirror.push(p);
      } else {
        mirror.sort((a, b) => a - b);
        expect(h.extractMin().priority).toBe(mirror.shift());
      }
    }
    expect(h.size).toBe(mirror.length);
  });

  it('counts inserts and extractions', () => {
    const h = new MinHeap();
    h.insert('a', 1);
    h.insert('b', 2);
    h.extractMin();
    expect(h.insertCount).toBe(2);
    expect(h.extractCount).toBe(1);
  });

  it('rejects non-numeric priorities', () => {
    const h = new MinHeap();
    expect(() => h.insert('x', NaN)).toThrow();
    expect(() => h.insert('x', '1')).toThrow();
  });
});
