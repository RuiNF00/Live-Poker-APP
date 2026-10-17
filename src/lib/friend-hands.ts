// "Mãos partilhadas" on the phone: friends' hands opened from a link, and how many comments on
// those and on your own shared hands you haven't seen. One call to the server counts them all
// (web/src/app/api/hands/comment-counts), when the app comes back to the front at most once a minute.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { useStore } from '@/store/store';

import { onEraseAll } from './erase-all';
import { parseFriendHands, parseSeen, remember, total, unseen, type FriendHand, type Seen } from './friend-hands-core';
import { fetchCommentCounts } from './share-api';

const HANDS_KEY = 'rl.friendHands.v1';
const SEEN_KEY = 'rl.commentsSeen.v1';
const REFRESH_MS = 60_000;

interface State {
  hands: FriendHand[];
  seen: Seen;
  counts: Record<string, number>;
}

let state: State = { hands: [], seen: {}, counts: {} };
let loaded: Promise<void> | null = null;
let fetchedAt = 0;
// First run of this feature: what was already there isn't "new".
let firstRun = false;
const listeners = new Set<(s: State) => void>();

function load(): Promise<void> {
  loaded ??= Promise.all([AsyncStorage.getItem(HANDS_KEY), AsyncStorage.getItem(SEEN_KEY)])
    .then(([h, s]) => {
      firstRun = s === null;
      state = { ...state, hands: parseFriendHands(h ? JSON.parse(h) : []), seen: parseSeen(s ? JSON.parse(s) : {}) };
      emit();
    })
    .catch(() => {});
  return loaded;
}

function emit() {
  for (const l of listeners) l(state);
}

async function set(next: Partial<State>) {
  await load();
  state = { ...state, ...next };
  emit();
  if (next.hands) await AsyncStorage.setItem(HANDS_KEY, JSON.stringify(state.hands)).catch(() => {});
  if (next.seen) await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(state.seen)).catch(() => {});
}

/** A friend's hand opened in the app: it goes on the list (your own links never do). */
export async function rememberFriendHand(id: string, title: string) {
  await load();
  await set({ hands: remember(state.hands, { id, title }, Date.now()) });
}

export async function forgetFriendHand(id: string) {
  await load();
  const { [id]: _s, ...seen } = state.seen;
  await set({ hands: state.hands.filter((h) => h.id !== id), seen });
}

/** The comments of this hand were on screen: none of them is new any more. */
export async function markCommentsSeen(id: string, count: number) {
  await load();
  if (state.seen[id] === count) return;
  await set({ seen: { ...state.seen, [id]: count }, counts: { ...state.counts, [id]: count } });
}

async function refresh(ids: string[], force = false) {
  if (!ids.length || (!force && Date.now() - fetchedAt < REFRESH_MS)) return;
  fetchedAt = Date.now();
  try {
    const got = await fetchCommentCounts(ids);
    const counts = Object.fromEntries(ids.map((id) => [id, got[id] ?? 0]));
    await set(firstRun ? { counts, seen: { ...counts, ...state.seen } } : { counts });
    firstRun = false;
  } catch {
    fetchedAt = 0;
  }
}

/** Friends' hands, your shared hands, and the new comments on each. */
export function useSharedHands(opts: { refresh?: boolean } = {}) {
  const { hands } = useStore();
  const [s, setS] = useState<State>(state);
  useEffect(() => {
    listeners.add(setS);
    load();
    return () => {
      listeners.delete(setS);
    };
  }, []);
  const mine = useMemo(() => hands.filter((h) => h.shareId).sort((a, b) => b.createdAt - a.createdAt), [hands]);
  const ids = useMemo(() => [...new Set([...mine.map((h) => h.shareId!), ...s.hands.map((h) => h.id)])].slice(0, 100), [mine, s.hands]);
  const key = ids.join(',');
  useEffect(() => {
    if (!key) return;
    const list = key.split(',');
    refresh(list, opts.refresh);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && refresh(list));
    return () => sub.remove();
  }, [key, opts.refresh]);
  const fresh = useMemo(() => unseen(s.counts, s.seen), [s.counts, s.seen]);
  return { friends: s.hands, mine, counts: s.counts, fresh, newTotal: total(fresh) };
}

onEraseAll(() => {
  // The stored copies go with the other rl.* keys; the memory copy goes now.
  state = { hands: [], seen: {}, counts: {} };
  emit();
});
