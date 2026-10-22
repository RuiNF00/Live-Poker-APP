// Keeps «O que fazes aqui?» (poker/drill) on the phone: when each hand comes back. Private, like
// the review note: it never leaves the phone and is erased with the rest of the data.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

import { answered, type DrillState } from '@/poker/drill';

const KEY = 'rl.drill.v1';

let state: DrillState = {};
let loaded: Promise<DrillState> | null = null;
const listeners = new Set<() => void>();

export function readDrill(): Promise<DrillState> {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      const v = raw ? (JSON.parse(raw) as DrillState) : {};
      state = v && typeof v === 'object' ? v : {};
      listeners.forEach((l) => l());
      return state;
    })
    .catch(() => state);
  return loaded;
}

function set(next: DrillState): void {
  state = next;
  listeners.forEach((l) => l());
  AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
}

/** The player answered the hand's question: it comes back later, or is done. */
export async function drillAnswered(id: string, now = Date.now()): Promise<void> {
  await readDrill();
  set(answered(state, id, now));
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export function useDrill(): DrillState {
  useEffect(() => void readDrill(), []);
  return useSyncExternalStore(subscribe, () => state);
}
