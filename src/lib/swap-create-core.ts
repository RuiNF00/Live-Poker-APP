// A swap created without signal: the create waits in the outbox (survives Voltar and a killed
// app) and goes out when the signal is back. The draft's key makes it safe to send twice: the
// screen's own retry and the outbox's land on the same swap. Pure, so it can be tested.

import { groupFromRemote, type GroupTerms, type RemoteGroup, type SwapGroup } from '@/store/swap-groups';
import { fromRemote, type RemoteSwap, type Swap, type SwapTerms } from '@/store/swaps';

export type CreateJob =
  | { kind: 'pair'; key: string; terms: SwapTerms; rc?: string }
  | { kind: 'group'; keys: { token: string; invite: string }; terms: GroupTerms; names: string[]; rc?: string };

/** What the swaps list shows while it waits: never the amounts, only who and what. */
export interface PendingCreate {
  key: string;
  group: boolean;
  title: string;
  /** Pair: the other player. Group: how many players. */
  with: string;
  at: number;
}

export const jobKey = (j: CreateJob) => (j.kind === 'pair' ? j.key : j.keys.token);

export function pendingOf(j: CreateJob, at: number): PendingCreate {
  return { key: jobKey(j), group: j.kind === 'group', title: j.terms.title, with: j.kind === 'pair' ? j.terms.b.name : String(j.names.length), at };
}

/** Newest first, one per key, a short list. */
export function addPending(list: PendingCreate[], p: PendingCreate): PendingCreate[] {
  return [p, ...list.filter((x) => x.key !== p.key)].slice(0, 20);
}

export interface CreateApi {
  createSwap(terms: SwapTerms, rc: string | undefined, key: string): Promise<{ swap: RemoteSwap; token: string }>;
  createGroup(terms: GroupTerms, names: string[], rc: string | undefined, keys: { token: string; invite: string }): Promise<{ group: RemoteGroup; token: string; invite: string }>;
  saveSwap(s: Swap): void;
  saveGroup(g: SwapGroup): void;
}

/** done: the swap is on the phone. retry: no signal or a server hiccup. drop: refused for good. */
export async function runCreate(j: CreateJob, api: CreateApi): Promise<'done' | 'retry' | 'drop'> {
  try {
    if (j.kind === 'pair') {
      const { swap, token } = await api.createSwap(j.terms, j.rc, j.key);
      api.saveSwap({ ...fromRemote(swap, token, 'a'), ownerRc: j.rc });
    } else {
      const { group, token, invite } = await api.createGroup(j.terms, j.names, j.rc, j.keys);
      api.saveGroup({ ...groupFromRemote(group, token, 0, invite), ownerRc: j.rc });
    }
    return 'done';
  } catch (e) {
    // A SwapError carries the server's status; anything else never reached it.
    const status = (e as { status?: unknown })?.status;
    if (typeof status !== 'number') return 'retry';
    return status === 408 || status === 429 || status >= 500 ? 'retry' : 'drop';
  }
}
