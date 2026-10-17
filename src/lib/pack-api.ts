// Hand packs on the phone (server: web/src/app/api/packs). Each hand keeps its own /h link; the pack
// is one more link that lists them, so a whole tournament goes to the group chat in one message.
// Deletes go through the outbox, so they also work without signal.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import type { ShareOptions } from '@/poker/privacy';
import type { Hand } from '@/poker/types';
import { BRAND } from '@/theme';

import { onEraseAll } from './erase-hooks';
import { packEraseJobs, parsePacks, type HandPack } from './pack-core';
import { uploadHand } from './share-api';
import { takeDirectShare } from './share-queue';
import { outcomeOf, queue, registerSender } from './sync';

const API = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? BRAND.webUrl;
const KEY = 'rl.packs.v1';

let cache: HandPack[] | null = null;
const listeners = new Set<(p: HandPack[]) => void>();

async function load(): Promise<HandPack[]> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = parsePacks(raw ? JSON.parse(raw) : []);
  } catch {
    cache = [];
  }
  return cache;
}

async function update(fn: (p: HandPack[]) => HandPack[]) {
  const next = fn(await load());
  cache = next;
  for (const l of listeners) l(next);
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
}

export function usePacks(): HandPack[] {
  const [s, setS] = useState<HandPack[]>(cache ?? []);
  useEffect(() => {
    let alive = true;
    load().then((x) => alive && setS(x));
    listeners.add(setS);
    return () => {
      alive = false;
      listeners.delete(setS);
    };
  }, []);
  return s;
}

export type PackError = 'offline' | 'rate_limited' | 'busy' | 'failed';

/**
 * Makes sure every hand has its own share link (saving each new one on the hand as it comes),
 * then asks the server for the pack. A hand whose link is still being made offline stops it: busy.
 */
export async function createPack(input: {
  hands: Hand[];
  title: string;
  hideAmounts: boolean;
  share: ShareOptions;
  saveHand: (h: Hand) => void;
}): Promise<{ ok: true; pack: HandPack; uploaded: number } | { ok: false; error: PackError }> {
  const claims: { id: string; token: string }[] = [];
  let uploaded = 0;
  try {
    for (const h of input.hands) {
      if (h.shareId && h.shareToken) {
        claims.push({ id: h.shareId, token: h.shareToken });
        continue;
      }
      const slot = await takeDirectShare(h.id);
      if (slot.kind === 'busy') return { ok: false, error: 'busy' };
      const link = slot.kind === 'ready' ? slot.link : await uploadHand(h, input.share).then((r) => ({ shareId: r.id, shareToken: r.token }));
      if (slot.kind !== 'ready') uploaded++;
      input.saveHand({ ...h, ...link });
      claims.push({ id: link.shareId, token: link.shareToken });
    }
  } catch (e) {
    return { ok: false, error: /^upload \d+$/.test((e as Error)?.message ?? '') ? 'failed' : 'offline' };
  }
  let r: Response;
  try {
    r = await fetch(`${API}/api/packs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: input.title, hideAmounts: input.hideAmounts, hands: claims }),
    });
  } catch {
    return { ok: false, error: 'offline' };
  }
  if (r.status === 429) return { ok: false, error: 'rate_limited' };
  if (!r.ok) return { ok: false, error: 'failed' };
  const j = (await r.json().catch(() => ({}))) as { id?: string; ownerToken?: string; url?: string };
  if (!j.id || !j.ownerToken || !j.url) return { ok: false, error: 'failed' };
  const pack: HandPack = {
    id: j.id,
    ownerToken: j.ownerToken,
    url: j.url,
    title: input.title,
    handIds: input.hands.map((h) => h.id),
    hideAmounts: input.hideAmounts,
    createdAt: Date.now(),
  };
  await update((p) => [pack, ...p]);
  return { ok: true, pack, uploaded };
}

/** Turns the pack link off. The hands' own links stay as they are. */
export async function deletePack(id: string) {
  const p = (await load()).find((x) => x.id === id);
  if (!p) return;
  await update((list) => list.filter((x) => x.id !== id));
  queue('pack-delete', { id: p.id, ownerToken: p.ownerToken }, p.id);
}

registerSender('pack-delete', async (p) => {
  const x = p as { id: string; ownerToken: string };
  const r = await fetch(`${API}/api/packs/${encodeURIComponent(x.id)}`, { method: 'DELETE', headers: { 'x-owner-token': x.ownerToken } });
  return r.status === 404 ? 'done' : outcomeOf(r.status);
});

onEraseAll(async () => {
  for (const j of packEraseJobs(await load())) queue(j.kind, j.payload, j.key);
  // The stored copy goes with the other rl.* keys; the memory copy goes now.
  cache = [];
  for (const l of listeners) l(cache);
});
