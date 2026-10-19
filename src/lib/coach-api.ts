// Private coaching links on the phone (server: web/src/app/api/coach). The player sends hands to a
// coach, the coach comments on the web, and the comments come back here: at launch, when the app
// returns to the foreground and, now and then, in the background, with one notification.
// Replies, revokes and erases go through the outbox, so they also work without signal.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { t } from '@/i18n';
import { publicHand } from '@/poker/privacy';
import type { Hand } from '@/poker/types';
import { BRAND } from '@/theme';

import {
  EMPTY_COACH,
  eraseJobs,
  markHandSeen,
  mergeComments,
  parseCoachState,
  parseComments,
  syncable,
  handsCommented,
  type CoachComment,
  type CoachLink,
  type CoachState,
  type ExpiryChoice,
} from './coach-core';
import { onEraseAll } from './erase-hooks';
import { notifications, setup } from './lock-screen/reminder';
import { notifyOrHold } from './notify-gate';
import { outcomeOf, queue, registerSender } from './sync';

const API = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? BRAND.webUrl;
const KEY = 'rl.coach.v1';
/** Kept when the player erases everything (erase-core KEEP_KEYS): erasing must not hand out another free link. */
export const FREE_KEY = 'rl.coach.free.v1';
const TASK = 'sweatbook-coach-sync';
const CHANNEL = 'coach';

let cache: CoachState | null = null;
const listeners = new Set<(s: CoachState) => void>();

async function load(): Promise<CoachState> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = parseCoachState(raw ? JSON.parse(raw) : {});
  } catch {
    cache = { ...EMPTY_COACH };
  }
  return cache;
}

async function update(fn: (s: CoachState) => CoachState): Promise<CoachState> {
  const next = fn(await load());
  cache = next;
  for (const l of listeners) l(next);
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  return next;
}

export function useCoach(): CoachState {
  const [s, setS] = useState<CoachState>(cache ?? EMPTY_COACH);
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

export async function freeLinkUsed(): Promise<boolean> {
  return (await AsyncStorage.getItem(FREE_KEY).catch(() => null)) === '1';
}

export type CreateResult = { ok: true; link: CoachLink } | { ok: false; error: 'offline' | 'error' | 'rate_limited' };

/** Uploads the hands (as on a share link: names only if the player shares them) and keeps the link. */
export async function createCoachLink(o: { hands: Hand[]; title: string; days: ExpiryChoice; player: string; names: boolean; notes: boolean; isPro: boolean }): Promise<CreateResult> {
  let r: Response;
  try {
    r = await fetch(`${API}/api/coach`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: o.title,
        player: o.player,
        expiresInDays: o.days ?? undefined,
        hands: o.hands.map((h) => ({ id: h.id, hand: publicHand(h, { names: o.names, notes: o.notes }) })),
      }),
    });
  } catch {
    return { ok: false, error: 'offline' };
  }
  const j = (await r.json().catch(() => ({}))) as { token?: string; ownerToken?: string; url?: string };
  if (r.status === 429) return { ok: false, error: 'rate_limited' };
  if (!r.ok || !j.token || !j.ownerToken || !j.url) return { ok: false, error: 'error' };
  const now = new Date().toISOString();
  const link: CoachLink = {
    token: j.token,
    ownerToken: j.ownerToken,
    title: o.title,
    url: j.url,
    handIds: o.hands.map((h) => h.id),
    createdAt: now,
    expiresAt: o.days ? new Date(Date.now() + o.days * 86400000).toISOString() : null,
    revokedAt: null,
    lastSync: null,
  };
  await update((s) => ({ ...s, links: [link, ...s.links] }));
  if (!o.isPro) await AsyncStorage.setItem(FREE_KEY, '1').catch(() => {});
  scheduleBackground(true);
  return { ok: true, link };
}

/** The coach loses access at once; the comments stay on the phone. */
export async function revokeCoachLink(token: string) {
  const s = await update((x) => ({ ...x, links: x.links.map((l) => (l.token === token ? { ...l, revokedAt: l.revokedAt ?? new Date().toISOString() } : l)) }));
  const l = s.links.find((x) => x.token === token);
  if (l) queue('coach-revoke', { token: l.token, ownerToken: l.ownerToken }, l.token);
}

/** The player's answer under a coach comment, shown at once and sent when there's signal. */
export async function replyToCoach(token: string, handId: string, stepIndex: number | null, name: string, body: string) {
  const text = body.trim().slice(0, 2000);
  if (!text) return;
  const local: CoachComment = {
    id: `local-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    handId,
    stepIndex,
    mark: null,
    author: 'player',
    name: (name.trim() || t('Jogador')).slice(0, 40),
    body: text,
    createdAt: new Date().toISOString(),
    pending: true,
  };
  const s = await update((x) => ({ ...x, comments: { ...x.comments, [token]: [...(x.comments[token] ?? []), local] } }));
  const l = s.links.find((x) => x.token === token);
  if (l) queue('coach-reply', { token, ownerToken: l.ownerToken, localId: local.id, handId, stepIndex, name: local.name, body: text }, local.id);
}

export async function markCoachSeen(handId: string) {
  const s = await load();
  if (markHandSeen(s, handId) !== s) await update((x) => markHandSeen(x, handId));
}

let running: Promise<number> | null = null;
/** Fetches new comments for every open link. Returns how many hands got new coach comments. */
export function syncCoach(): Promise<number> {
  running ??= (async () => {
    const fresh: CoachComment[] = [];
    for (const l of syncable(await load())) {
      try {
        const q = l.lastSync ? `?since=${encodeURIComponent(l.lastSync)}` : '';
        const r = await fetch(`${API}/api/coach/${l.token}/comments${q}`, { headers: { 'x-owner-token': l.ownerToken } });
        if (r.status === 404) {
          // Purged on the server: nothing more will come.
          await update((s) => ({ ...s, links: s.links.map((x) => (x.token === l.token ? { ...x, revokedAt: x.revokedAt ?? new Date().toISOString() } : x)) }));
          continue;
        }
        if (!r.ok) continue;
        const incoming = parseComments(await r.json());
        let got: CoachComment[] = [];
        await update((s) => {
          const m = mergeComments(s, l.token, incoming);
          got = m.fresh;
          return m.state;
        });
        fresh.push(...got);
      } catch {
        // No signal: try again next time.
      }
    }
    const n = handsCommented(fresh);
    if (n && AppState.currentState !== 'active') await notify(n);
    return n;
  })().finally(() => {
    running = null;
  });
  return running;
}

async function notify(n: number) {
  const N = notifications();
  if (!N) return;
  try {
    await setup(N);
    if (!(await N.getPermissionsAsync()).granted) return;
    // Off in Settings: nothing. During a live session: waits for the end or a pause.
    notifyOrHold('coach', () => {
      void post(N, n);
    });
  } catch (e) {
    console.warn('[coach] notify', e);
  }
}

async function post(N: NonNullable<ReturnType<typeof notifications>>, n: number) {
  try {
    await N.scheduleNotificationAsync({
      identifier: 'coach-comments',
      content: {
        title: t('Comentários do coach'),
        body: n === 1 ? t('O teu coach comentou 1 mão') : t('O teu coach comentou {n} mãos', { n }),
        data: { url: 'sweatbook://coach' },
        sound: true,
      },
      trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
    });
  } catch (e) {
    console.warn('[coach] notify', e);
  }
}

// Background sync: iOS and Android decide when it runs (on iOS often overnight, on Wi-Fi and power),
// so the foreground sync below does the day-to-day work. Loaded lazily: web and the tests skip it.
type BG = { bt: typeof import('expo-background-task'); tm: typeof import('expo-task-manager') };
let bg: BG | null | undefined;
function background(): BG | null {
  if (bg !== undefined) return bg;
  if (Platform.OS === 'web') return (bg = null);
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    bg = { bt: require('expo-background-task'), tm: require('expo-task-manager') } as BG;
    /* eslint-enable @typescript-eslint/no-require-imports */
    if (!bg.tm.isTaskDefined(TASK)) {
      const b = bg.bt;
      bg.tm.defineTask(TASK, async () => {
        try {
          await syncCoach();
          return b.BackgroundTaskResult.Success;
        } catch {
          return b.BackgroundTaskResult.Failed;
        }
      });
    }
  } catch {
    bg = null;
  }
  return bg;
}

/** On while some link can still get comments, off otherwise. */
async function scheduleBackground(on?: boolean) {
  const b = background();
  if (!b) return;
  try {
    const want = on ?? syncable(await load()).length > 0;
    const has = await b.tm.isTaskRegisteredAsync(TASK);
    if (want && !has) await b.bt.registerTaskAsync(TASK, { minimumInterval: 60 });
    if (!want && has) await b.bt.unregisterTaskAsync(TASK);
  } catch (e) {
    console.warn('[coach] background', e);
  }
}

registerSender('coach-reply', async (p) => {
  const x = p as { token: string; ownerToken: string; localId: string; handId: string; stepIndex: number | null; name: string; body: string };
  const r = await fetch(`${API}/api/coach/${x.token}/replies`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-owner-token': x.ownerToken },
    body: JSON.stringify({ handId: x.handId, stepIndex: x.stepIndex, name: x.name, body: x.body, key: x.localId }),
  });
  const out = outcomeOf(r.status);
  if (out === 'retry') return out;
  const [c] = out === 'done' ? parseComments({ comments: [((await r.json().catch(() => ({}))) as { comment?: unknown }).comment] }) : [];
  await update((s) => {
    const list = (s.comments[x.token] ?? []).filter((y) => y.id !== x.localId);
    // Link closed before the reply got out: it stays, marked as not sent.
    if (!c && out === 'drop') {
      const mine = (s.comments[x.token] ?? []).find((y) => y.id === x.localId);
      if (mine) list.push({ ...mine, pending: false, id: `${mine.id}-unsent` });
    }
    if (c && !list.some((y) => y.id === c.id)) list.push(c);
    return { ...s, comments: { ...s.comments, [x.token]: list } };
  });
  return out;
});

registerSender('coach-revoke', async (p) => {
  const x = p as { token: string; ownerToken: string };
  const r = await fetch(`${API}/api/coach/${x.token}`, { method: 'DELETE', headers: { 'x-owner-token': x.ownerToken } });
  return r.status === 404 ? 'done' : outcomeOf(r.status);
});

registerSender('coach-erase', async (p) => {
  const x = p as { token: string; ownerToken: string };
  const r = await fetch(`${API}/api/coach/${x.token}?erase=1`, { method: 'DELETE', headers: { 'x-owner-token': x.ownerToken } });
  return r.status === 404 ? 'done' : outcomeOf(r.status);
});

onEraseAll(async () => {
  const s = await load();
  for (const j of eraseJobs(s)) queue(j.kind, j.payload, j.key);
  // The stored copy goes with the other rl.* keys (eraseLocal); the memory copy goes now.
  cache = { ...EMPTY_COACH };
  for (const l of listeners) l(cache);
  scheduleBackground(false);
});

let started = false;
/** Once, at startup: sync now and whenever the app comes back to the foreground. */
export function startCoachSync() {
  if (started) return;
  started = true;
  setTimeout(() => {
    syncCoach().catch(() => {});
    scheduleBackground();
  }, 4000);
  AppState.addEventListener('change', (st) => {
    if (st === 'active') syncCoach().catch(() => {});
  });
}

// The task has to be defined when the app is launched in the background, before any screen.
background();
