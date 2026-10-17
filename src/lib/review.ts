// The store review prompt (design/pedido-avaliacao.md). Only the moments in
// that file call maybeAskForReview; review-core decides. Never on a button:
// "Avaliar a Sweatbook" in Settings opens the store page instead.
// expo-store-review is required lazily so web and the Node tests never load it.

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useEffect } from 'react';
import { Linking, Platform } from 'react-native';

import { profit } from '@/store/session-math';
import { useStore } from '@/store/store';

import { track } from './events';
import { blockReason, noteAsk, noteDay, type ReviewMoment, type ReviewState } from './review-core';

const KEY = 'rl.review.v1';
const version = () => Constants.expoConfig?.version ?? '0';

type SR = typeof import('expo-store-review');
function storeReview(): SR | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-store-review') as SR;
  } catch {
    return null;
  }
}

async function load(now = Date.now()): Promise<ReviewState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as ReviewState;
  } catch {}
  return { installedAt: now, days: [], asks: [], versions: [] };
}
const save = (s: ReviewState) => AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});

// What the store knows, mirrored by <ReviewSync /> for callers outside React.
let hands = 0;
let live = false;
let recentLoss = false;
let error = false;
let overlays = 0;

/** A sync, share or purchase error the player saw: no prompt until the app opens again. */
export function noteVisibleError() {
  error = true;
}

/** A sheet or alert opened (true) or closed (false). */
export function noteOverlay(open: boolean) {
  overlays = Math.max(0, overlays + (open ? 1 : -1));
}

/** Paywall seen, cancel flow entered, or trial started / Pro bought. */
export async function noteReviewBlocker(kind: 'paywall' | 'cancel' | 'bought') {
  const s = await load();
  const now = Date.now();
  await save(kind === 'paywall' ? { ...s, paywallAt: now } : kind === 'cancel' ? { ...s, cancelAt: now } : { ...s, boughtAt: now });
}

/** Call at one of the three moments; it asks only when every rule in §3 says yes. */
export async function maybeAskForReview(moment: ReviewMoment): Promise<boolean> {
  const sr = storeReview();
  if (!sr) return false;
  // Let the moment's own animation finish first.
  await new Promise((r) => setTimeout(r, 1000));
  const s = await load();
  const n = { now: Date.now(), version: version(), hands, live, recentLoss, error, overlay: overlays > 0 };
  if (blockReason(s, n)) return false;
  try {
    if (!(await sr.isAvailableAsync())) return false;
    await save(noteAsk(s, n));
    track('review_prompt', { moment });
    await sr.requestReview();
    return true;
  } catch {
    return false;
  }
}

/** "Avaliar a Sweatbook": the store's write-a-review page. */
export async function openStoreReviewPage() {
  const url = storeReview()?.storeUrl();
  if (!url) return;
  await Linking.openURL(Platform.OS === 'ios' ? `${url}${url.includes('?') ? '&' : '?'}action=write-review` : url).catch(() => {});
}

/** Mounted once in the root layout: counts days used and mirrors the store. */
export function ReviewSync() {
  const { ready, hands: list, sessions, activeSession } = useStore();
  useEffect(() => {
    load().then((s) => save(noteDay(s, Date.now())));
  }, []);
  useEffect(() => {
    if (!ready) return;
    const now = Date.now();
    hands = list.length;
    live = !!activeSession;
    recentLoss = sessions.some((s) => s.endedAt && now - s.endedAt < 86_400_000 && profit(s) < 0);
  }, [ready, list, sessions, activeSession]);
  return null;
}
