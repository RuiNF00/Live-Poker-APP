// Where an install came from and what was going on, for the funnel: do players
// who arrive during a festival or with a session running convert better?
// First touch only, kept on the phone. No personal data: a source label, a
// short campaign tag, and two booleans.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { FESTIVALS, venueTime, type Festival } from '@/poker/festivals';

export type Source = 'utm_campaign' | 'invite' | 'swap' | 'backer_page' | 'shared_hand';

const KEY = 'rl.source.v1';
const DAY = 86_400_000;

interface Saved {
  source: Source;
  campaign?: string;
}

let saved: Promise<Saved | null> | null = null;
const load = () => (saved ??= AsyncStorage.getItem(KEY).then((v) => (v ? (JSON.parse(v) as Saved) : null)).catch(() => null));

/** Records how this install first arrived. Later links never overwrite it. */
export function noteSource(source: Source, campaign?: string): void {
  saved = load().then((cur) => {
    if (cur) return cur;
    const next: Saved = { source, ...(campaign ? { campaign: campaign.replace(/[^\w.-]/g, '').slice(0, 40) } : {}) };
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    return next;
  });
}

/** The source of a deep link, from its kind and query (pure, tested). */
export function linkSource(kind: 'hand' | 'invite' | 'swap' | 'backer', q: { r?: string; utm_campaign?: string; utm_source?: string }): Source {
  // Hand links carry the hand id as utm_campaign: only other links count as a campaign.
  if (kind !== 'hand' && q.utm_campaign) return 'utm_campaign';
  if (kind === 'swap') return 'swap';
  if (kind === 'backer') return 'backer_page';
  if (kind === 'invite' || q.r) return 'invite';
  return 'shared_hand';
}

let live = false;
/** Kept current by the Pro provider, which already watches the running session. */
export function setLiveSession(open: boolean) {
  live = open;
}

/** True from the day before a shipped festival's first event to the day after its last. */
export function festivalOn(now: number, festivals: Festival[] = FESTIVALS): boolean {
  return festivals.some((f) => {
    const ts = f.events.map((e) => venueTime(f, e.start));
    return ts.length > 0 && now >= Math.min(...ts) - DAY && now <= Math.max(...ts) + DAY;
  });
}

export async function attribution(now = Date.now()): Promise<Record<string, string | boolean>> {
  const s = await load();
  return { source: s?.source ?? 'direct', ...(s?.campaign ? { campaign: s.campaign } : {}), live_session_open: live, festival_on: festivalOn(now) };
}

const ONBOARDING = 'rl.onboarding.v1';

/** The onboarding answers that split the paywall funnel by player type (quiz answers, nothing personal). */
export async function profile(): Promise<Record<string, string>> {
  try {
    const v = await AsyncStorage.getItem(ONBOARDING);
    const a = v ? (JSON.parse(v) as { volume?: unknown; plays?: unknown }) : {};
    return { volume: typeof a.volume === 'string' ? a.volume : '', plays: typeof a.plays === 'string' ? a.plays : '' };
  } catch {
    return { volume: '', plays: '' };
  }
}
