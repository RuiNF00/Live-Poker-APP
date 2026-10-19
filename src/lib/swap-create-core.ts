// A swap created, confirmed or joined without signal: it waits in the outbox (survives Voltar and
// a killed app) and goes out when the signal is back. The screen's key makes it safe to send twice:
// the screen's own retry and the outbox's land on the same swap or seat. Pure, so it can be tested.

import { groupFromRemote, type GroupTerms, type RemoteGroup, type SwapGroup } from '@/store/swap-groups';
import { fromRemote, type RemoteSwap, type Swap, type SwapTerms } from '@/store/swaps';

/** `id`: the link's id (swapIdFor), already sent while there was no signal. */
export type CreateJob =
  | { kind: 'pair'; key: string; terms: SwapTerms; rc?: string; id?: string }
  | { kind: 'group'; keys: { token: string; invite: string }; terms: GroupTerms; names: string[]; rc?: string; id?: string }
  /** Someone's swap, confirmed here: `with` is who proposed it. */
  | { kind: 'confirm'; id: string; key: string; name: string; title: string; with: string }
  /** A seat in someone's group, picked here. */
  | { kind: 'claim'; id: string; key: string; invite: string; seat: number; title: string; players: number };

/** What the swaps list shows while it waits: never the amounts, only who and what. */
export interface PendingCreate {
  key: string;
  group: boolean;
  title: string;
  /** Pair: the other player. Group: how many players. */
  with: string;
  at: number;
  /** The link already made, to send it again from the list. */
  link?: { url: string; message: string };
  /** Confirm or seat: the swap's or group's id, so its screen shows it as waiting too. */
  of?: string;
}

export const jobKey = (j: CreateJob) => (j.kind === 'group' ? j.keys.token : j.key);

export function pendingOf(j: CreateJob, at: number, link?: PendingCreate['link']): PendingCreate {
  const key = jobKey(j);
  if (j.kind === 'confirm') return { key, group: false, title: j.title, with: j.with, at, of: j.id };
  if (j.kind === 'claim') return { key, group: true, title: j.title, with: String(j.players), at, of: j.id };
  return { key, group: j.kind === 'group', title: j.terms.title, with: j.kind === 'pair' ? j.terms.b.name : String(j.names.length), at, ...(link ? { link } : {}) };
}

/** Newest first, one per key, a short list. */
export function addPending(list: PendingCreate[], p: PendingCreate): PendingCreate[] {
  return [p, ...list.filter((x) => x.key !== p.key)].slice(0, 20);
}

export interface CreateApi {
  createSwap(terms: SwapTerms, rc: string | undefined, key: string, id?: string): Promise<{ swap: RemoteSwap; token: string }>;
  createGroup(terms: GroupTerms, names: string[], rc: string | undefined, keys: { token: string; invite: string }, id?: string): Promise<{ group: RemoteGroup; token: string; invite: string }>;
  confirmSwap(id: string, name: string, key: string): Promise<{ swap: RemoteSwap; token: string }>;
  claimSeat(id: string, invite: string, seat: number, key: string): Promise<{ group: RemoteGroup; token: string }>;
  saveSwap(s: Swap): void;
  saveGroup(g: SwapGroup): void;
}

/** done: the swap is on the phone. retry: no signal or a server hiccup. drop: refused for good. */
export async function runCreate(j: CreateJob, api: CreateApi): Promise<'done' | 'retry' | 'drop'> {
  try {
    if (j.kind === 'confirm') {
      const { swap, token } = await api.confirmSwap(j.id, j.name, j.key);
      api.saveSwap(fromRemote(swap, token, 'b'));
    } else if (j.kind === 'claim') {
      const { group, token } = await api.claimSeat(j.id, j.invite, j.seat, j.key);
      api.saveGroup(groupFromRemote(group, token, j.seat));
    } else if (j.kind === 'pair') {
      const { swap, token } = await api.createSwap(j.terms, j.rc, j.key, j.id);
      api.saveSwap({ ...fromRemote(swap, token, 'a'), ownerRc: j.rc });
    } else {
      const { group, token, invite } = await api.createGroup(j.terms, j.names, j.rc, j.keys, j.id);
      api.saveGroup({ ...groupFromRemote(group, token, 0, invite), ownerRc: j.rc });
    }
    return 'done';
  } catch (e) {
    // A SwapError carries the server's status; anything else never reached it.
    const status = (e as { status?: unknown })?.status;
    if (typeof status !== 'number') return 'retry';
    // Only if two keys ever gave the same id: the swap still gets made, with an id the server picks.
    if (status === 409 && (j.kind === 'pair' || j.kind === 'group') && j.id && (e as { code?: unknown }).code === 'id_taken') return runCreate({ ...j, id: undefined }, api);
    return status === 408 || status === 429 || status >= 500 ? 'retry' : 'drop';
  }
}
