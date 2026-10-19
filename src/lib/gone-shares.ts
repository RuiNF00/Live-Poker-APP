// Hands from a backup that still carry a public link the server no longer has: the
// backup was made before «Apagar todos os meus dados» (which deleted every link) and
// restored after it. Pure, so it can be tested; share-queue.ts gives it the outbox and the network.

import type { Hand } from '@/poker/types';

export interface GoneIO {
  /** The link's delete is still waiting in the outbox (no signal since the erase). */
  deleteWaiting: (shareId: string) => Promise<boolean>;
  /** The server's HTTP status for the link; throws with no answer. */
  status: (shareId: string) => Promise<number>;
}

/**
 * handId → shareId of the links that are gone. Only a plain answer counts: a link the
 * server still has (a restore onto a new phone after losing the old one) stays, and so
 * does one that couldn't be checked (no signal, server busy).
 */
export async function goneShares(hands: readonly Pick<Hand, 'id' | 'shareId'>[], io: GoneIO): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const h of hands) {
    const id = h.shareId;
    if (!id) continue;
    try {
      if ((await io.deleteWaiting(id)) || [404, 410].includes(await io.status(id))) out.set(h.id, id);
    } catch {
      // Not checked: the link stays as it was.
    }
  }
  return out;
}

/** The hand without its link (a newer copy, so the next backup carries it too). */
export function unshared<T extends Pick<Hand, 'shareId' | 'shareToken' | 'updatedAt'>>(h: T, now = Date.now()): T {
  const { shareId: _id, shareToken: _token, ...rest } = h;
  return { ...rest, updatedAt: now } as T;
}
