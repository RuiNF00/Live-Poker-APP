// The phone's group swaps: a copy of each group on the server plus this seat's token, on disk
// like every other list. Same shape as swaps-store.ts: prizes and payments added without
// signal wait here (pending) and go out on the next sync.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo, useSyncExternalStore } from 'react';

import { appUserId } from '@/billing/purchases';
import { SwapError, newCid } from '@/lib/swap-api';
import { addGroupEntry, fetchGroup, leaveGroup, removeGroupEntry, setGroupOwnerRc } from '@/lib/swap-group-api';

import { createWriter, loadCollection, type CollectionSpec, type KV } from './persist';
import { mergeGroups, mergeRemoteGroup, newFromOthers, type GroupEntry, type RemoteGroup, type SwapGroup } from './swap-groups';

const SPEC: CollectionSpec = { index: 'rl.swapgroups.v1', prefix: 'rl.swapgroup.v1.' };
const kv = AsyncStorage as unknown as KV;

type State = { ready: boolean; groups: SwapGroup[] };
let state: State = { ready: false, groups: [] };
const listeners = new Set<() => void>();
let writer: ReturnType<typeof createWriter<SwapGroup>> | null = null;
let booting: Promise<void> | null = null;

function emit(next: SwapGroup[]) {
  state = { ready: true, groups: next };
  writer?.schedule(next);
  listeners.forEach((l) => l());
}

function boot(): Promise<void> {
  booting ??= loadCollection<SwapGroup>(kv, SPEC).then((d) => {
    writer = createWriter(kv, SPEC, d.persisted, (e) => console.warn('[swap-groups] write failed', e));
    const ids = new Set(state.groups.map((g) => g.id));
    emit([...state.groups, ...d.items.filter((g) => !ids.has(g.id))]);
  });
  return booting;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  boot();
  return () => listeners.delete(l);
};

export async function getAllGroups(): Promise<SwapGroup[]> {
  await boot();
  return state.groups;
}

export const currentGroups = () => state.groups;
export const getGroup = (id: string) => state.groups.find((g) => g.id === id);

export async function importGroups(incoming: SwapGroup[]): Promise<number> {
  await boot();
  const r = mergeGroups(state.groups, incoming);
  if (r.list !== state.groups) emit(r.list);
  return r.added;
}

export function forgetGroupsLocally() {
  emit([]);
}

export function saveGroup(g: SwapGroup) {
  const i = state.groups.findIndex((x) => x.id === g.id);
  emit(i < 0 ? [g, ...state.groups] : state.groups.map((x, j) => (j === i ? g : x)));
}

type News = (g: SwapGroup, entries: GroupEntry[]) => void;
const newsListeners = new Set<News>();

/** Told when a sync brings in prizes or payments other players added. */
export function onGroupNews(l: News): () => void {
  newsListeners.add(l);
  return () => newsListeners.delete(l);
}

function applyRemote(id: string, remote: RemoteGroup) {
  const cur = getGroup(id);
  if (!cur) return;
  const next = mergeRemoteGroup(cur, remote);
  saveGroup(next);
  const news = newFromOthers(cur, next);
  if (news.length) newsListeners.forEach((l) => l(next, news));
}

/** Sends what is waiting, then takes the server's copy. False without signal. */
export async function syncGroup(id: string): Promise<boolean> {
  await boot();
  let g = getGroup(id);
  if (!g || g.gone) return true;
  try {
    for (const e of g.entries.filter((x) => x.pending)) {
      try {
        applyRemote(id, await addGroupEntry(id, g.token, e));
      } catch (err) {
        if (err instanceof SwapError && err.status === 422) {
          g = getGroup(id)!;
          saveGroup({ ...g, entries: g.entries.filter((x) => x.cid !== e.cid) });
        } else if (!(err instanceof SwapError)) throw err;
      }
    }
    g = getGroup(id)!;
    if (g.seat === 0) {
      // The accounts follow the creator's Pro: keep the server's copy of my id current.
      const rc = await appUserId();
      if (rc && rc !== g.ownerRc) {
        await setGroupOwnerRc(id, g.token, rc).then(() => saveGroup({ ...getGroup(id)!, ownerRc: rc }), () => {});
        g = getGroup(id)!;
      }
    }
    const remote = await fetchGroup(id, g.token);
    if (!remote) saveGroup({ ...g, gone: true, entries: g.entries.map(({ pending: _, ...e }) => e), updatedAt: Date.now() });
    else applyRemote(id, remote);
    return true;
  } catch {
    return false;
  }
}

export async function syncAllGroups(): Promise<void> {
  await boot();
  await Promise.all(state.groups.filter((g) => !g.gone && !g.archived).map((g) => syncGroup(g.id)));
}

/** A prize I won or a payment I made: saved at once, sent now or on the next sync. */
export async function addGroupPrize(id: string, e: Pick<GroupEntry, 'kind' | 'amount' | 'event' | 'finish' | 'to'>, sessionId?: string): Promise<'sent' | 'queued'> {
  const g = getGroup(id);
  if (!g) return 'queued';
  const cid = newCid();
  const links = sessionId ? { ...g.links, [cid]: sessionId } : g.links;
  saveGroup({ ...g, links, entries: [...g.entries, { ...e, id: cid, cid, seat: g.seat, at: Date.now(), pending: true }], updatedAt: Date.now() });
  await syncGroup(id);
  return getGroup(id)?.entries.some((x) => x.cid === cid && x.pending) ? 'queued' : 'sent';
}

export async function removeGroupEntryHere(id: string, entry: GroupEntry): Promise<boolean> {
  const g = getGroup(id);
  if (!g || entry.seat !== g.seat) return false;
  if (entry.pending || g.gone) {
    saveGroup({ ...g, entries: g.entries.filter((x) => x.cid !== entry.cid || x.seat !== entry.seat), updatedAt: Date.now() });
    return true;
  }
  try {
    applyRemote(id, await removeGroupEntry(id, g.token, entry.id));
    return true;
  } catch {
    return false;
  }
}

/** The creator deletes it for everyone; anyone else leaves. Then it's gone from this phone. */
export async function leaveGroupEverywhere(id: string): Promise<boolean> {
  const g = getGroup(id);
  if (!g) return true;
  if (!g.gone) {
    try {
      await leaveGroup(id, g.token);
    } catch {
      return false;
    }
  }
  emit(state.groups.filter((x) => x.id !== id));
  return true;
}

export function useGroups() {
  const snap = useSyncExternalStore(subscribe, () => state);
  return useMemo(() => ({ ready: snap.ready, groups: [...snap.groups].sort((a, b) => b.createdAt - a.createdAt) }), [snap]);
}

boot();
