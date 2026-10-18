// The player's deletes on this phone (see deleted-math.ts for why they're kept).

import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseOrQuarantine } from './boot';
import { cleanDeleted, joinDeleted, keyOf, type Deleted, type DeletedList } from './deleted-math';
import type { KV } from './persist';

// ─── Persistence ─────────────────────────────────────────────────────────────

const KEY = 'rl.deleted.v1';

let map: Deleted = {};
let loaded: Promise<void> | null = null;

function load(): Promise<void> {
  loaded ??= AsyncStorage.getItem(KEY)
    .then(async (raw) => {
      const saved = raw ? await parseOrQuarantine<unknown>(AsyncStorage as unknown as KV, KEY, raw, (v) => !!v && typeof v === 'object') : null;
      // Deletes made before the read finished stay.
      map = joinDeleted(cleanDeleted(saved), map);
    })
    .catch(() => {});
  return loaded;
}

function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify(map)).catch(() => {});
}

/** Reads the deletes; the app waits for it at launch (see store.tsx). */
export const loadDeleted = (): Promise<void> => load();

/** Every delete, for the backup. */
export function currentDeleted(): Deleted {
  void load();
  return map;
}

export function markDeleted(list: DeletedList, ids: string[], at = Date.now()) {
  if (!ids.length) return;
  map = joinDeleted(map, Object.fromEntries(ids.map((id) => [keyOf(list, id), at])));
  void load().then(persist);
}

/** A backup's deletes join this phone's. */
export function importDeleted(incoming: Deleted | undefined) {
  if (!incoming || !Object.keys(incoming).length) return;
  map = joinDeleted(map, incoming);
  void load().then(persist);
}

/** A restore brought these back on purpose: they are no longer deleted here. */
export function forgetDeleted(keys: string[]) {
  const drop = keys.filter((k) => k in map);
  if (!drop.length) return;
  map = { ...map };
  for (const k of drop) delete map[k];
  void load().then(() => {
    for (const k of drop) delete map[k];
    persist();
  });
}

/** Delete all my data: the stored map is already gone, forget the one in memory. */
export function clearDeleted() {
  map = {};
}
