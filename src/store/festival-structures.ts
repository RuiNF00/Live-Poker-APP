// The published blind structures, read when a tournament screen opens: their
// own chunk, like the schedules (my-festivals.ts), so the launch bundle stays the same.

import { useSyncExternalStore } from 'react';

import type { Structure } from '@/poker/festivals';

type Structures = Record<string, Record<number, Structure>>;

let all: Structures | null = null;
let reading: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** Reads the structures once; a failed read (web, offline) is tried again on the next call. */
export function loadStructures(load: () => Promise<{ STRUCTURES: Structures }> = () => import('../poker/festival-structures')): Promise<void> {
  reading ??= load().then(
    (m) => {
      all = m.STRUCTURES;
      for (const l of listeners) l();
    },
    () => {
      reading = null;
    },
  );
  return reading;
}

function subscribe(l: () => void) {
  void loadStructures();
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The tournament's structure; undefined while reading, null when none is published for it. */
export function useStructure(festivalId: string, number: number): Structure | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (all ? (all[festivalId]?.[number] ?? null) : undefined),
    () => undefined,
  );
}
