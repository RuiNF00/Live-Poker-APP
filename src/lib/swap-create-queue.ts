// Swaps created without signal (swap-create-core.ts): the create waits in the outbox and the
// swaps list shows it as waiting until it lands. Imported at startup so the sender is
// registered before the outbox first drains.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { saveGroup } from '@/store/swap-groups-store';
import { saveSwap } from '@/store/swaps-store';

import { onEraseAll } from './erase-all';
import { createSwap } from './swap-api';
import { addPending, jobKey, pendingOf, runCreate, type CreateJob, type PendingCreate } from './swap-create-core';
import { createGroup } from './swap-group-api';
import { queue, queued, registerSender, unqueue } from './sync';

const KIND = 'swap-create';
const KEY = 'rl.swapCreates.v1';

let cache: PendingCreate[] | null = null;
const listeners = new Set<(l: PendingCreate[]) => void>();

async function load(): Promise<PendingCreate[]> {
  if (cache) return cache;
  try {
    const v = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]') as unknown;
    cache = Array.isArray(v) ? (v as PendingCreate[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

async function update(fn: (l: PendingCreate[]) => PendingCreate[]) {
  const next = fn(await load());
  cache = next;
  for (const l of listeners) l(next);
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
}

/** No signal: the create goes out by itself when it's back, even after Voltar or a restart. */
export function queueSwapCreate(job: CreateJob) {
  queue(KIND, job, jobKey(job));
  void update((l) => addPending(l, pendingOf(job, Date.now())));
}

/** The screen created it itself: nothing left to send. */
export function forgetSwapCreate(key: string) {
  void unqueue(KIND, key);
  void update((l) => l.filter((x) => x.key !== key));
}

registerSender(KIND, async (p) => {
  const job = p as CreateJob;
  const out = await runCreate(job, { createSwap, createGroup, saveSwap, saveGroup });
  if (out !== 'retry') await update((l) => l.filter((x) => x.key !== jobKey(job)));
  return out;
});

/** The swaps still waiting for signal to be created, newest first. */
export function usePendingSwapCreates(): PendingCreate[] {
  const [list, setList] = useState<PendingCreate[]>(cache ?? []);
  useEffect(() => {
    let alive = true;
    // One the outbox gave up on (weeks without signal) no longer waits.
    load()
      .then(async (l) => {
        const left = new Set((await Promise.all(l.map(async (x) => ((await queued(KIND, x.key)) ? null : x.key)))).filter(Boolean));
        // A minute's grace: a create queued a moment ago may not be in the outbox yet.
        if (left.size) await update((cur) => cur.filter((x) => !left.has(x.key) || Date.now() - x.at < 60000));
      })
      .then(() => alive && setList(cache ?? []));
    listeners.add(setList);
    return () => {
      alive = false;
      listeners.delete(setList);
    };
  }, []);
  return list;
}

// "Delete all my data": the outbox is kept (it holds the deletes), so a create still waiting
// is taken out of it here; otherwise it would make a new swap after the erase.
onEraseAll(async () => {
  for (const x of await load()) await unqueue(KIND, x.key);
  await update(() => []);
});
