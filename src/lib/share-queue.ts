// Share links made without signal: the upload waits in the outbox and runs when the
// network is back. The new link is kept here until the hand screen picks it up and
// saves it on the hand (the store lives in React, the outbox doesn't).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';

import type { ShareOptions } from '@/poker/privacy';
import type { Hand } from '@/poker/types';

import { uploadHand } from './share-api';
import { outcomeOf, queue, registerSender } from './sync';

const KEY = 'sweatbook.share-queue.v1';
type Ready = { shareId: string; shareToken: string };
type State = { waiting: string[]; ready: Record<string, Ready> };

let cache: State | null = null;
const listeners = new Set<() => void>();

async function load(): Promise<State> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as Partial<State>) : {};
    cache = { waiting: Array.isArray(v.waiting) ? v.waiting : [], ready: v.ready && typeof v.ready === 'object' ? v.ready : {} };
  } catch {
    cache = { waiting: [], ready: {} };
  }
  return cache;
}

async function update(fn: (s: State) => void) {
  const s = await load();
  fn(s);
  for (const l of listeners) l();
  await AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});
}

/** True when the error means "no network" rather than "the server said no". */
export function isNetworkError(e: unknown): boolean {
  return !/^upload \d+$/.test((e as Error)?.message ?? '');
}

/** Keep this hand's upload for when the signal is back. */
export function queueShare(hand: Hand, opts: ShareOptions) {
  queue('share-upload', { hand, opts }, hand.id);
  update((s) => {
    if (!s.waiting.includes(hand.id)) s.waiting.push(hand.id);
  }).catch(() => {});
}

registerSender('share-upload', async (p) => {
  const { hand, opts } = p as { hand: Hand; opts: ShareOptions };
  let out: Ready;
  try {
    const r = await uploadHand(hand, opts);
    out = { shareId: r.id, shareToken: r.token };
  } catch (e) {
    if (isNetworkError(e)) return 'retry';
    const verdict = outcomeOf(Number((e as Error).message.slice(7)));
    if (verdict === 'drop') await update((s) => void (s.waiting = s.waiting.filter((id) => id !== hand.id)));
    return verdict;
  }
  await update((s) => {
    s.waiting = s.waiting.filter((id) => id !== hand.id);
    s.ready[hand.id] = out;
  });
  return 'done';
});

/**
 * On a hand's screen: saves a link that was made in the background onto the hand,
 * and says whether one is still waiting for signal.
 */
export function useQueuedShare(hand: Hand | undefined, save: (h: Hand) => void): boolean {
  const [waiting, setWaiting] = useState(false);
  // The latest hand, so a link that lands later never undoes edits made meanwhile.
  const latest = useRef(hand);
  useEffect(() => {
    latest.current = hand;
  });
  const id = hand?.id;
  const has = !!hand?.shareId;
  useEffect(() => {
    if (!id) return;
    let live = true;
    const check = async () => {
      const s = await load();
      if (!live) return;
      const r = s.ready[id];
      const h = latest.current;
      if (r && h && !h.shareId) save({ ...h, ...r });
      if (r) await update((x) => void delete x.ready[id]);
      setWaiting(!r && !has && s.waiting.includes(id));
    };
    check();
    listeners.add(check);
    return () => {
      live = false;
      listeners.delete(check);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, has]);
  return waiting;
}
