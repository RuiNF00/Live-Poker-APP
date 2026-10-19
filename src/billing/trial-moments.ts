// The trial outside the paywall flow (payments/teardown-paywalls.md §5):
// - the trial is offered once at the start of the first live session, so its
//   days (3, set in the stores) are spent at the table, not at home (first run
//   shows no paywall); a "plan" paywall can also push it there ("Prefiro começar na próxima sessão");
// - when a trial is turned off, or ends, the app says once, calmly, what stays.
// The trial length always comes from the store product, never from here.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { QUIET_FROM, QUIET_TO } from '../lib/notify-policy';

import type { Trial } from './nudges';

const DAY = 86_400_000;
const KEYS = { defer: 'rl.trial.defer.v1', seen: 'rl.trial.seen.v1', last: 'rl.trial.last.v1', proEnded: 'rl.pro.ended.v1', proEndSeen: 'rl.pro.endSeen.v1', billingSeen: 'rl.pro.billingSeen.v1' };

/** "O que fica grátis" still shows if the app is opened up to this long after the trial ended. */
export const ENDED_DAYS = 14;

export interface DeferState {
  /** When the player chose to start at the next session (absent if they never saw that choice). */
  at?: number;
  /** When the session-start paywall was shown; it shows once. */
  shown?: number;
}

/** Whether starting a live session now should open the trial paywall: once, for a free player who can still start a trial (pure, tested). */
export function sessionStartOffer(s: DeferState | null, o: { isPro: boolean; trialDays: number }): boolean {
  return !s?.shown && !o.isPro && o.trialDays > 0;
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
export const markSessionOffer = (s: DeferState | null, now = Date.now()) => write(KEYS.defer, { ...s, shown: now });

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

/** The one-time screens wait out the quiet hours (23:00 to 12:00), like notifications do. */
export const inQuietHours = (hour: number) => hour >= QUIET_FROM || hour < QUIET_TO;

/**
 * Whether to say, once, that Pro ended (invite days, a cancelled subscription, a refund).
 * A trial that ran out has its own screen ("O teu trial acabou"), so it isn't said twice (pure, tested).
 */
export function proEndNotice(ended: number | null, seen: number | null, lastTrialEnd: number | null, o: { isPro: boolean; now: number }): boolean {
  if (!ended || o.isPro || seen === ended || o.now - ended > ENDED_DAYS * DAY) return false;
  return !(lastTrialEnd && lastTrialEnd <= ended && ended - lastTrialEnd <= ENDED_DAYS * DAY);
}

export const markProEnded = (now = Date.now()) => write(KEYS.proEnded, now);
export const proEnded = () => read<number>(KEYS.proEnded);
export const proEndSeen = () => read<number>(KEYS.proEndSeen);
export const markProEndSeen = (at: number) => write(KEYS.proEndSeen, at);

/** A failed renewal is said once per issue (the store's own emails and sheet do the rest). */
export const billingNotice = (since: number | null, seen: number | null) => !!since && since !== seen;
export const billingSeen = () => read<number>(KEYS.billingSeen);
export const markBillingSeen = (since: number) => write(KEYS.billingSeen, since);
