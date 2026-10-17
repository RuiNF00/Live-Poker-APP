// Puts the planned Pro nudges (nudges.ts) on the phone as local notifications.
// Local notifications work in Expo Go too. Each sync cancels and re-plans all
// three, so counts, dates and the come-back day follow the latest data.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { t } from '@/i18n';
import { notifications, setup } from '@/lib/lock-screen/reminder';

import { NUDGE_IDS, planNudges, type NudgeInput, type Trial } from './nudges';
import { getTrial } from './purchases';

const CHANNEL = 'pro';
const LOCAL_TRIAL = 'rl.trial.v1';
/** Opened when a nudge is tapped: the hands list. */
const URL = 'sweatbook://';

/** Demo store (Expo Go, no RevenueCat key): remember the trial the player just started. */
export async function rememberTrial(days: number, now = Date.now()): Promise<void> {
  const trial: Trial = { start: now, end: now + days * 86_400_000, willRenew: true };
  await AsyncStorage.setItem(LOCAL_TRIAL, JSON.stringify(trial)).catch(() => {});
}

async function currentTrial(): Promise<Trial | null> {
  const fromStore = await getTrial();
  if (fromStore !== undefined) return fromStore;
  try {
    const raw = await AsyncStorage.getItem(LOCAL_TRIAL);
    return raw ? (JSON.parse(raw) as Trial) : null;
  } catch {
    return null;
  }
}

let channel: Promise<unknown> | null = null;

let queue: Promise<void> = Promise.resolve();

/** One sync at a time, so a cancel never lands between another sync's schedules. */
export function syncNudges(input: Omit<NudgeInput, 'trial' | 'store'>): Promise<void> {
  queue = queue.then(() => sync(input));
  return queue;
}

async function sync(input: Omit<NudgeInput, 'trial' | 'store'>): Promise<void> {
  const n = notifications();
  if (!n) return;
  try {
    await setup(n);
    if (Platform.OS === 'android') channel ??= n.setNotificationChannelAsync(CHANNEL, { name: t('Lembretes do Pro'), importance: n.AndroidImportance.DEFAULT });
    await channel;
    await Promise.all(NUDGE_IDS.map((id) => n.cancelScheduledNotificationAsync(`sweatbook-${id}`)));
    if (!(await n.getPermissionsAsync()).granted) return;
    const store = Platform.OS === 'android' ? 'Google Play' : 'App Store';
    const trial = input.isPro ? await currentTrial() : null;
    for (const x of planNudges({ ...input, trial, store })) {
      await n.scheduleNotificationAsync({
        identifier: `sweatbook-${x.id}`,
        content: { title: x.title, body: x.body, data: { url: URL } },
        trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: x.at, channelId: CHANNEL },
      });
    }
  } catch (e) {
    console.warn('[pro] nudges', e);
  }
}
