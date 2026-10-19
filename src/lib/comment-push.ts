// "Novo comentário na tua mão": a push when a friend comments a hand you shared. The phone's
// Expo push token goes to the server per shared hand, only once notifications are allowed, and
// leaves with the link ("Apagar partilha", "Apagar tudo") or when the switch goes off. Quiet hours,
// one notice per hand until it's opened and the text all live on the server (migration 310000).
// Needs the store build: without an EAS project id there is no push token ("Disponível na versão da loja").

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getCalendars } from 'expo-localization';
import { Platform } from 'react-native';

import { variant } from '@/i18n';
import type { Hand } from '@/poker/types';

import { commentPushReady } from './comment-push-ready';
import { notifications } from './lock-screen/reminder';
import { API } from './share-api';

// Shared hands this phone asked notices for, so opening one only tells the server when it matters.
const KEY = 'rl.commentPush.v1';

type Owned = Pick<Hand, 'shareId' | 'shareToken'>;

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return Constants.easConfig?.projectId ?? extra?.eas?.projectId;
}

/** Push needs a native store build with an EAS project; elsewhere the switch says "Disponível na versão da loja". */
export function commentPushAvailable(): boolean {
  return Platform.OS !== 'web' && !!projectId() && !!notifications();
}

async function registered(): Promise<string[]> {
  try {
    const v: unknown = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

async function remember(id: string, on: boolean) {
  const list = (await registered()).filter((x) => x !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(on ? [...list, id].slice(-500) : list)).catch(() => {});
}

/** This phone's Expo push token, only when notifications are already allowed. */
async function pushToken(): Promise<string | null> {
  const n = notifications();
  const pid = projectId();
  if (!n || !pid || Platform.OS === 'web') return null;
  try {
    if (!(await n.getPermissionsAsync()).granted) return null;
    return (await n.getExpoPushTokenAsync({ projectId: pid })).data;
  } catch {
    return null;
  }
}

async function send(h: Owned, pushToken: string | null): Promise<boolean> {
  if (!h.shareId || !h.shareToken) return false;
  const res = await fetch(`${API}/api/hands/${encodeURIComponent(h.shareId)}/push`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-edit-token': h.shareToken },
    body: JSON.stringify({ pushToken, lang: variant, tz: getCalendars()[0]?.timeZone ?? 'UTC' }),
  });
  return res.ok;
}

/** Notices on for this shared hand (no-op without permission or outside the store build). */
export async function turnOnCommentPush(h: Owned): Promise<boolean> {
  const token = await pushToken();
  if (!token || !h.shareId) return false;
  const ok = await send(h, token).catch(() => false);
  if (ok) await remember(h.shareId, true);
  return ok;
}

/** The switch in Settings went off: the server forgets this phone for every hand. */
export async function turnOffCommentPush(hands: Owned[]): Promise<void> {
  const ids = new Set(await registered());
  await Promise.all(hands.filter((h) => h.shareId && ids.has(h.shareId)).map((h) => send(h, null).then(() => remember(h.shareId!, false)).catch(() => {})));
}

const REFRESH_KEY = 'rl.commentPush.at.v1';

/**
 * "Mãos partilhadas" opened: the hands this phone asked notices for are sent again, at most once
 * a day, so the server's 180-day clean-up only takes tokens nobody uses and a new token replaces an old one.
 */
export async function refreshCommentPush(hands: Owned[]): Promise<void> {
  const last = Number(await AsyncStorage.getItem(REFRESH_KEY).catch(() => null)) || 0;
  if (Date.now() - last < 86_400_000) return;
  const ids = new Set(await registered());
  const mine = hands.filter((h) => h.shareId && ids.has(h.shareId)).slice(-50);
  if (!mine.length) return;
  const token = await pushToken();
  if (!token) return;
  await AsyncStorage.setItem(REFRESH_KEY, String(Date.now())).catch(() => {});
  await Promise.all(mine.map((h) => send(h, token).catch(() => false)));
}

/**
 * The owner opened the hand: the next comment may notify again. A hand shared before notices
 * were on gets them now, without asking (only when they're already allowed).
 */
export async function openedOwnHand(h: Owned, wanted: boolean): Promise<void> {
  if (!h.shareId || !h.shareToken) return;
  const on = (await registered()).includes(h.shareId);
  if (on) {
    await fetch(`${API}/api/hands/${encodeURIComponent(h.shareId)}/push`, { method: 'PATCH', headers: { 'x-edit-token': h.shareToken } }).catch(() => {});
  } else if (wanted && commentPushAvailable() && (await commentPushReady())) await turnOnCommentPush(h);
}
