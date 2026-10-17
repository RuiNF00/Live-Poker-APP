// "Mãos partilhadas" on the phone: friends' hands opened from a link, and how many comments on
// those and on your own shared hands you haven't seen. One call to the server counts them all
// (web/src/app/api/hands/comment-counts), when the app comes back to the front at most once a minute.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { useStore } from '@/store/store';

import { onEraseAll } from './erase-hooks';
import { parseFriendHands, parseSeen, remember, total, unseen, type FriendHand, type Seen } from './friend-hands-core';
import { fetchCommentCounts } from './share-api';

const HANDS_KEY = 'rl.friendHands.v1';
const SEEN_KEY = 'rl.commentsSeen.v1';
// Hands you reported: they leave the list and don't come back if the link is opened again.
const HIDDEN_KEY = 'rl.friendHandsHidden.v1';
const MAX_HIDDEN = 200;
// Commenters blocked on this phone ("c:<id>", the id is per hand).
const BLOCKED_KEY = 'rl.blocked.v1';
const REFRESH_MS = 60_000;

interface State {
  hands: FriendHand[];
  seen: Seen;
  counts: Record<string, number>;
  hidden: string[];
  blocked: string[];
}

let state: State = { hands: [], seen: {}, counts: {}, hidden: [], blocked: [] };
let loaded: Promise<void> | null = null;
let fetchedAt = 0;
// First run of this feature: what was already there isn't "new".
let firstRun = false;
const listeners = new Set<(s: State) => void>();

function load(): Promise<void> {
  loaded ??= Promise.all([AsyncStorage.getItem(HANDS_KEY), AsyncStorage.getItem(SEEN_KEY), AsyncStorage.getItem(HIDDEN_KEY), AsyncStorage.getItem(BLOCKED_KEY)])
    .then(([h, s, x, b]) => {
      firstRun = s === null;
      const hidden: unknown = x ? JSON.parse(x) : [];
      const blocked: unknown = b ? JSON.parse(b) : [];
      state = {
        ...state,
        hands: parseFriendHands(h ? JSON.parse(h) : []),
        seen: parseSeen(s ? JSON.parse(s) : {}),
        hidden: strings(hidden),
        blocked: strings(blocked),
      };
      emit();
    })
    .catch(() => {});
  return loaded;
}

const strings = (x: unknown) => (Array.isArray(x) ? x.filter((i): i is string => typeof i === 'string').slice(0, MAX_HIDDEN) : []);

function emit() {
  for (const l of listeners) l(state);
}

async function set(next: Partial<State>) {
  await load();
  state = { ...state, ...next };
  emit();
  if (next.hands) await AsyncStorage.setItem(HANDS_KEY, JSON.stringify(state.hands)).catch(() => {});
  if (next.seen) await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(state.seen)).catch(() => {});
  if (next.hidden) await AsyncStorage.setItem(HIDDEN_KEY, JSON.stringify(state.hidden)).catch(() => {});
  if (next.blocked) await AsyncStorage.setItem(BLOCKED_KEY, JSON.stringify(state.blocked)).catch(() => {});
}

/** A friend's hand opened in the app: it goes on the list (your own links never do). */
export async function rememberFriendHand(id: string, title: string, cards?: string[]) {
  await load();
  if (state.hidden.includes(id)) return;
  await set({ hands: remember(state.hands, { id, title, cards }, Date.now()) });
}

/** Reported: off the list for good on this phone. */
export async function hideFriendHand(id: string) {
  await forgetFriendHand(id);
  if (!state.hidden.includes(id)) await set({ hidden: [id, ...state.hidden].slice(0, MAX_HIDDEN) });
}

export async function forgetFriendHand(id: string) {
  await load();
  const { [id]: _s, ...seen } = state.seen;
  await set({ hands: state.hands.filter((h) => h.id !== id), seen });
}

/** Their comments disappear from this phone (on the hand where they were blocked). */
export async function blockCommenter(by: string) {
  await load();
  if (!state.blocked.includes(`c:${by}`)) await set({ blocked: [`c:${by}`, ...state.blocked].slice(0, MAX_HIDDEN) });
}

/** What this phone blocked, for screens that show other people's comments. */
export function useBlocked() {
  const [b, setB] = useState(state.blocked);
  useEffect(() => {
    const l = (s: State) => setB(s.blocked);
    listeners.add(l);
    load().then(() => setB(state.blocked));
    return () => {
      listeners.delete(l);
    };
  }, []);
  return useMemo(() => ({ commenter: (by?: string) => !!by && b.includes(`c:${by}`) }), [b]);
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
  state = { hands: [], seen: {}, counts: {}, hidden: [], blocked: [] };
  emit();
});
