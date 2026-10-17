// The phone's swaps: a copy of each swap on the server plus this side's token, on disk like
// every other list (per-item keys). Kept apart from the main store so swaps never re-render
// hands or sessions. Prizes and payments added without signal wait here (pending) and go out
// on the next sync.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo, useSyncExternalStore } from 'react';

import { addSwapEntry, deleteSwap, fetchSwap, newCid, removeSwapEntry, SwapError } from '@/lib/swap-api';

import { createWriter, loadCollection, type CollectionSpec, type KV } from './persist';
import { mergeRemote, mergeSwaps, type RemoteSwap, type Swap, type SwapEntry } from './swaps';

const SPEC: CollectionSpec = { index: 'rl.swaps.v1', prefix: 'rl.swap.v1.' };
const kv = AsyncStorage as unknown as KV;

type State = { ready: boolean; swaps: Swap[] };
let state: State = { ready: false, swaps: [] };
const listeners = new Set<() => void>();
let writer: ReturnType<typeof createWriter<Swap>> | null = null;
let booting: Promise<void> | null = null;

function emit(next: Swap[]) {
  state = { ready: true, swaps: next };
  writer?.schedule(next);
  listeners.forEach((l) => l());
}

function boot(): Promise<void> {
  booting ??= loadCollection<Swap>(kv, SPEC).then((d) => {
    writer = createWriter(kv, SPEC, d.persisted, (e) => console.warn('[swaps] write failed', e));
    // Anything saved before loading finished goes on top of what was on disk.
    const ids = new Set(state.swaps.map((s) => s.id));
    emit([...state.swaps, ...d.items.filter((s) => !ids.has(s.id))]);
  });
  return booting;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  boot();
  return () => listeners.delete(l);
};

/** Every swap on the phone, once loaded from disk. */
export async function getAllSwaps(): Promise<Swap[]> {
  await boot();
  return state.swaps;
}

/**
 * A backup coming in: swaps this phone doesn't have are added; for one it has, the copy
 * changed last wins, keeping entries this phone hasn't sent yet. Returns how many are new.
 */
export async function importSwaps(incoming: Swap[]): Promise<number> {
  await boot();
  const r = mergeSwaps(state.swaps, incoming);
  if (r.list !== state.swaps) emit(r.list);
  return r.added;
}

/** After "Delete all my data": the keys are already gone from disk, this empties memory. */
export function forgetSwapsLocally() {
  emit([]);
}

/** The list as it is now (empty until loaded, which starts when this module is imported). */
export function currentSwaps(): Swap[] {
  return state.swaps;
}

export function getSwap(id: string): Swap | undefined {
  return state.swaps.find((s) => s.id === id);
}

export function saveSwap(s: Swap) {
  const i = state.swaps.findIndex((x) => x.id === s.id);
  emit(i < 0 ? [s, ...state.swaps] : state.swaps.map((x, j) => (j === i ? s : x)));
}

function applyRemote(id: string, remote: RemoteSwap) {
  const cur = getSwap(id);
  if (cur) saveSwap(mergeRemote(cur, remote));
}

/**
 * Sends what is waiting, then takes the server's copy. Returns false without signal (the
 * phone's copy stays as it is). A swap the server no longer has is kept here, marked gone.
 */
export async function syncSwap(id: string): Promise<boolean> {
  await boot();
  let s = getSwap(id);
  if (!s || s.gone) return true;
  try {
    for (const e of s.entries.filter((x) => x.pending)) {
      try {
        applyRemote(id, await addSwapEntry(id, s.token, e));
      } catch (err) {
        // Not confirmed yet: it stays pending. Refused for good (bad data): drop it.
        if (err instanceof SwapError && err.status === 422) {
          s = getSwap(id)!;
          saveSwap({ ...s, entries: s.entries.filter((x) => x.cid !== e.cid) });
        } else if (!(err instanceof SwapError)) throw err;
      }
    }
    s = getSwap(id)!;
    const remote = await fetchSwap(id, s.token);
    if (!remote) saveSwap({ ...s, gone: true, entries: s.entries.map(({ pending: _, ...e }) => e), updatedAt: Date.now() });
    else applyRemote(id, remote);
    return true;
  } catch {
    return false;
  }
}

export async function syncAllSwaps(): Promise<void> {
  await boot();
  await Promise.all(state.swaps.filter((s) => !s.gone && !s.archived).map((s) => syncSwap(s.id)));
}

/** A prize I won or a payment I made: saved at once, sent now or on the next sync. */
export async function addEntry(id: string, e: Pick<SwapEntry, 'kind' | 'amount' | 'event' | 'finish'>): Promise<'sent' | 'queued'> {
  const s = getSwap(id);
  if (!s) return 'queued';
  const cid = newCid();
  saveSwap({ ...s, entries: [...s.entries, { ...e, id: cid, cid, side: s.side, at: Date.now(), pending: true }], updatedAt: Date.now() });
  await syncSwap(id);
  return getSwap(id)?.entries.some((x) => x.cid === cid && x.pending) ? 'queued' : 'sent';
}

/** Removes one of my entries. One not sent yet just goes; a sent one needs signal. */
export async function removeEntry(id: string, entry: SwapEntry): Promise<boolean> {
  const s = getSwap(id);
  if (!s || entry.side !== s.side) return false;
  if (entry.pending || s.gone) {
    saveSwap({ ...s, entries: s.entries.filter((x) => x.cid !== entry.cid || x.side !== entry.side), updatedAt: Date.now() });
    return true;
  }
  try {
    applyRemote(id, await removeSwapEntry(id, s.token, entry.id));
    return true;
  } catch {
    return false;
  }
}

/** Deletes it on the server for both players, then here. False without signal. */
export async function deleteSwapEverywhere(id: string): Promise<boolean> {
  const s = getSwap(id);
  if (!s) return true;
  if (!s.gone) {
    try {
      await deleteSwap(id, s.token);
    } catch {
      return false;
    }
  }
  emit(state.swaps.filter((x) => x.id !== id));
  return true;
}

export function useSwaps() {
  const snap = useSyncExternalStore(subscribe, () => state);
  return useMemo(() => {
    const sorted = [...snap.swaps].sort((a, b) => b.createdAt - a.createdAt);
    return { ready: snap.ready, swaps: sorted };
  }, [snap]);
}

// Start reading at launch, so a backup taken early already has the swaps.
boot();
