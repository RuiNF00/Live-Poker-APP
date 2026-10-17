// The trial outside the paywall flow (payments/teardown-paywalls.md §5):
// - a player who plays a few sessions a month can push the trial to their next
//   live session, so its days are spent at the table, not at home;
// - when a trial is turned off, or ends, the app says once, calmly, what stays.
// The trial length always comes from the store product, never from here.

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Trial } from './nudges';

const DAY = 86_400_000;
const KEYS = { defer: 'rl.trial.defer.v1', seen: 'rl.trial.seen.v1', last: 'rl.trial.last.v1' };

/** A deferred offer is forgotten after this long without a live session. */
export const DEFER_DAYS = 120;
/** "O que fica grátis" still shows if the app is opened up to this long after the trial ended. */
export const ENDED_DAYS = 14;

export interface DeferState {
  at: number;
  /** When the session-start paywall was shown; it shows once. */
  shown?: number;
}

/** Whether starting a live session now should open the trial paywall (pure, tested). */
export function sessionStartOffer(s: DeferState | null, o: { isPro: boolean; trialDays: number; now: number }): boolean {
  return !!s && !s.shown && !o.isPro && o.trialDays > 0 && o.now - s.at < DEFER_DAYS * DAY;
}

export type TrialNotice = 'cancelled' | 'ended';

/** Trial starts the player has already been told about, per notice. */
export interface Seen {
  cancelled?: number;
  ended?: number;
}

/** Which one-time trial screen to show now, if any (pure, tested). */
export function trialNotice(trial: Trial | null, seen: Seen, o: { isPro: boolean; now: number }): TrialNotice | null {
  if (!trial) return null;
  if (o.now < trial.end) return !trial.willRenew && seen.cancelled !== trial.start ? 'cancelled' : null;
  if (o.isPro || seen.ended === trial.start || o.now - trial.end > ENDED_DAYS * DAY) return null;
  return 'ended';
}

async function read<T>(key: string): Promise<T | null> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
const write = (key: string, v: unknown) => AsyncStorage.setItem(key, JSON.stringify(v)).catch(() => {});

export const deferTrial = (now = Date.now()) => write(KEYS.defer, { at: now } satisfies DeferState);
export const deferState = () => read<DeferState>(KEYS.defer);
export const markSessionOffer = (s: DeferState, now = Date.now()) => write(KEYS.defer, { ...s, shown: now });

export const seenNotices = async () => (await read<Seen>(KEYS.seen)) ?? {};
export const markNotice = async (kind: TrialNotice, start: number) => write(KEYS.seen, { ...(await seenNotices()), [kind]: start });

/**
 * The store stops reporting a trial once it's over, so the last one seen is
 * kept here: it's how the app knows a trial just ended.
 */
export async function withLastTrial(current: Trial | null): Promise<Trial | null> {
  if (current) {
    await write(KEYS.last, current);
    return current;
  }
  return read<Trial>(KEYS.last);
}
