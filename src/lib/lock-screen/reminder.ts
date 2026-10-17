// Level-up reminder: one local notification at the end of the current level,
// rescheduled whenever the level, its length or a pause changes it. Local
// notifications work in Expo Go too, so this is the part Rui can try there.
// expo-notifications is required lazily so web and the Node tests never load it.

import { Platform } from 'react-native';

import { t } from '@/i18n';
import { isPaused } from '@/store/session-math';
import type { Session } from '@/store/types';

import { levelUpMessage, nextLevelAt } from './live-state';

const ID = 'sweatbook-level-up';
const CHANNEL = 'level-up';
/** Opened when the reminder is tapped: the session screen, where the level goes up. */
export const LEVEL_UP_URL = 'sweatbook://session';

type N = typeof import('expo-notifications');
let mod: N | null | undefined;

function notifications(): N | null {
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
function setup(n: N) {
  ready ??= (async () => {
    // Show it even with the app open: the player may be looking at the hands list.
    n.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
    if (Platform.OS === 'android') {
      await n.setNotificationChannelAsync(CHANNEL, { name: t('Subida de nível'), importance: n.AndroidImportance.HIGH, vibrationPattern: [0, 250, 150, 250] });
    }
  })().catch(() => {});
  return ready;
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
    if (!s || isPaused(s)) return;
    const at = nextLevelAt(s, now);
    if (!at || at <= now + 5_000) return;
    if (!(await n.getPermissionsAsync()).granted) return;
    const { title, body } = levelUpMessage(s);
    await n.scheduleNotificationAsync({
      identifier: ID,
      content: { title, body, data: { url: LEVEL_UP_URL }, sound: true },
      trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
    });
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
