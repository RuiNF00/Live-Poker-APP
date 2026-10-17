// Level-up reminder: one local notification at the end of the current level,
// rescheduled whenever the level, its length or a pause changes it. Local
// notifications work in Expo Go too, so this is the part Rui can try there.
// expo-notifications is required lazily so web and the Node tests never load it.

import { Platform } from 'react-native';

import { t } from '@/i18n';
import { isPaused } from '@/store/session-math';
import type { Session } from '@/store/types';

import { breakEndMessage, breakOf, levelUpMessage, nextLevelAt } from './live-state';

const ID = 'sweatbook-level-up';
const BREAK_ID = 'sweatbook-break-end';
/** How long before the end of a break the player is called back to the table. */
const BREAK_WARNING = 2 * 60_000;
const CHANNEL = 'level-up';
/** Opened when the reminder is tapped: the session screen, where the level goes up. */
export const LEVEL_UP_URL = 'sweatbook://session';
/** Android channel of the ongoing session notification. */
export const SESSION_CHANNEL = 'session';

export type N = typeof import('expo-notifications');
let mod: N | null | undefined;

/** expo-notifications, or null where it can't load (web, tests). Shared with the Pro nudges. */
export function notifications(): N | null {
  if (mod !== undefined) return mod;
  if (Platform.OS === 'web') return (mod = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-notifications') as N;
  } catch {
    mod = null;
  }
  return mod;
}

let ready: Promise<void> | null = null;
export function setup(n: N) {
  ready ??= (async () => {
    // Show it even with the app open: the player may be looking at the hands list.
    n.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
    if (Platform.OS === 'android') {
      await n.setNotificationChannelAsync(CHANNEL, { name: t('Níveis e intervalos'), importance: n.AndroidImportance.HIGH, vibrationPattern: [0, 250, 150, 250] });
      // The running session: quiet, and on a locked phone only "Sweatbook" with the contents hidden (no stack, no blinds).
      await n.setNotificationChannelAsync(SESSION_CHANNEL, { name: t('Sessão a decorrer'), importance: n.AndroidImportance.LOW, lockscreenVisibility: n.AndroidNotificationVisibility.PRIVATE });
    }
  })().catch(() => {});
  return ready;
}

/** Make sure the Android channels exist before posting to them. */
export async function notificationChannels(): Promise<void> {
  const n = notifications();
  if (n) await setup(n);
}

/** Ask once, when the player shows they want reminders. True when allowed. */
export async function askNotificationPermission(): Promise<boolean> {
  const n = notifications();
  if (!n) return false;
  try {
    const cur = await n.getPermissionsAsync();
    if (cur.granted) return true;
    if (!cur.canAskAgain) return false;
    return (await n.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Schedule (or move, or cancel) the reminder for this session. Null clears it. */
export async function syncLevelReminder(s: Session | null, now = Date.now()): Promise<void> {
  const n = notifications();
  if (!n) return;
  try {
    await setup(n);
    await n.cancelScheduledNotificationAsync(ID);
    // Paused for the break: keep the call back to the table that was set before it.
    if (!s || !isPaused(s)) await n.cancelScheduledNotificationAsync(BREAK_ID);
    if (!s || isPaused(s)) return;
    const at = nextLevelAt(s, now);
    if (!at || at <= now + 5_000) return;
    if (!(await n.getPermissionsAsync()).granted) return;
    const { title, body } = levelUpMessage(s);
    await n.scheduleNotificationAsync({
      identifier: ID,
      content: { title, body, data: { url: LEVEL_UP_URL }, sound: true, interruptionLevel: 'timeSensitive' },
      trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
    });
    // The structure's next break: a call back a couple of minutes before play starts again.
    const b = breakOf(s, now);
    const back = b ? b.at + b.minutes * 60_000 - BREAK_WARNING : 0;
    if (b && back > now + 5_000) {
      await n.scheduleNotificationAsync({
        identifier: BREAK_ID,
        content: { ...breakEndMessage(s, b), data: { url: LEVEL_UP_URL }, sound: true, interruptionLevel: 'timeSensitive' },
        trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: back, channelId: CHANNEL },
      });
    }
  } catch (e) {
    console.warn('[lock-screen] reminder', e);
  }
}

/** Calls `open` with the URL of a tapped reminder, including the one that launched the app. */
export function onReminderTap(open: (url: string) => void): () => void {
  const n = notifications();
  if (!n) return () => {};
  const handle = (r: { notification: { request: { content: { data?: Record<string, unknown> | null } } } } | null) => {
    const url = r?.notification.request.content.data?.url;
    if (typeof url === 'string') open(url);
  };
  try {
    handle(n.getLastNotificationResponse());
    n.clearLastNotificationResponse?.();
    const sub = n.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
