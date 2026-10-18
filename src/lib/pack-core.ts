// Hand packs: several hands behind one link (sweatbook.poker/p/<id>). Pure helpers, no I/O.

import { isComplete } from '@/poker/engine';
import type { Hand } from '@/poker/types';

/** Same cap as the server (web/src/lib/pack-data.ts). */
export const MAX_PACK_HANDS = 30;

export interface HandPack {
  id: string;
  ownerToken: string;
  url: string;
  title: string;
  /** Local hand ids, in the order they appear in the link. */
  handIds: string[];
  hideAmounts: boolean;
  createdAt: number;
}

/** The hands that go: complete ones, oldest first (the order they were played), the latest MAX_PACK_HANDS. */
export function packHands(list: Hand[]): { send: Hand[]; left: number; extra: number } {
  const sorted = [...list].sort((a, b) => a.createdAt - b.createdAt);
  const done = sorted.filter((h) => isComplete(h));
  return { send: done.slice(-MAX_PACK_HANDS), left: sorted.length - done.length, extra: Math.max(0, done.length - MAX_PACK_HANDS) };
}

/** Packs as stored, dropping anything malformed. */
export function parsePacks(x: unknown): HandPack[] {
  if (!Array.isArray(x)) return [];
  return x.filter(
    (p): p is HandPack =>
      !!p &&
      typeof p.id === 'string' &&
      typeof p.ownerToken === 'string' &&
      typeof p.url === 'string' &&
      typeof p.title === 'string' &&
      Array.isArray(p.handIds) &&
      typeof p.createdAt === 'number',
  );
}

/** Server deletes queued on "erase everything": one per pack. */
export function packEraseJobs(packs: HandPack[]) {
  return packs.map((p) => ({ kind: 'pack-delete', payload: { id: p.id, ownerToken: p.ownerToken }, key: p.id }));
}
