// Counting over every hand (or session) without holding up the first frame.
// With years of data a full pass can take a second on a mid-range phone (each
// hand is replayed), so it runs in small slices after the screen has drawn.
// Small lists, and lists whose answers are already cached, count at once.

import { useEffect, useState } from 'react';

/** How many items one slice handles before giving the frame back: about 15 ms on a slow phone, so a tap never waits on it. */
const SLICE = 50;

/** Counts `items` matching `test` in slices; pure, so the tests drive it with their own scheduler. */
export function countInSlices<T>(items: readonly T[], test: (x: T) => boolean, done: (n: number) => void, schedule: (f: () => void) => unknown = (f) => setTimeout(f, 0)): () => void {
  let cancelled = false;
  let i = 0;
  let n = 0;
  const step = () => {
    if (cancelled) return;
    const end = Math.min(items.length, i + SLICE);
    for (; i < end; i++) if (test(items[i])) n++;
    if (i < items.length) schedule(step);
    else done(n);
  };
  step();
  return () => {
    cancelled = true;
  };
}

/**
 * The number of `items` passing `test`, or null until it is known. `test`
 * must be stable (module-level) and is expected to cache its own work.
 */
export function useIdleCount<T>(items: readonly T[], test: (x: T) => boolean): number | null {
  const [state, setState] = useState<{ items: readonly T[]; n: number } | null>(null);
  useEffect(() => countInSlices(items, test, (n) => setState({ items, n })), [items, test]);
  // Until the new count lands, keep showing the last one (a saved hand moves it by one at most).
  return state ? state.n : null;
}
