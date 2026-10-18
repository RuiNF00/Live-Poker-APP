// Invites: a friend who arrives through your link and saves a first hand gets
// you both 50% off the first month of Pro for 72 hours (booked server-side; the
// stores apply it, see INVITE in billing/plans). The code is
// this install's referral code (the `r=` on shared links).
// Every call fails quietly: invites are a bonus, never in the way.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { appUserId } from '@/billing/purchases';
import { BRAND } from '@/theme';

import { onEraseAll } from './erase-hooks';
import { installId, refCode, setRefCode, track } from './events';
import { createInviteReward, OFFER_KEY, openOffer, type Activation, type ClaimState, type InviteOffer } from './invite-reward';
import { isOnline } from './online';
import { outcomeOf, queue, registerSender } from './sync';

export type { InviteOffer } from './invite-reward';

const API = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? BRAND.webUrl;
const K = { first: 'rl.first.v1', registered: 'rl.ref.reg.v1', shared: 'rl.ref.shared.v1', checked: 'rl.ref.checked.v1', offer: OFFER_KEY };
const WINDOW = 7 * 86400000;

export type ClaimSource = 'share' | 'story' | 'link' | 'manual' | 'play_referrer';
/** queued: no signal now; the claim is kept on the phone and sent when there is. */
export type ClaimResult = 'ok' | 'already' | 'unknown_code' | 'self' | 'too_late' | 'error' | 'disabled' | 'queued';

async function post<T>(path: string, body: Record<string, unknown>): Promise<T | null> {
  const res = await fetch(`${API}/api/referrals/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ installId: await installId(), rcUserId: await appUserId(), platform: Platform.OS, ...body }),
  });
  if (res.status === 503) return null;
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as T;
}

async function getJSON<T>(key: string): Promise<T | null> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

/** When the app was first opened on this install. */
export async function firstOpenAt(): Promise<number> {
  const v = await getJSON<number>(K.first);
  if (v) return v;
  const now = Date.now();
  await AsyncStorage.setItem(K.first, JSON.stringify(now)).catch(() => {});
  return now;
}

const reward = createInviteReward(AsyncStorage, () => post<{ booked?: boolean }>('activate', {}));

/** Not booked yet (offline, or RevenueCat hasn't seen this user): the outbox tries again later. */
function retryLater(a: Activation): Activation {
  if (a === 'not_yet') queue('invite-activate', {}, 'activate');
  return a;
}

registerSender('invite-activate', async () => ((await reward.activate()) === 'not_yet' ? 'retry' : 'done'));

export async function claimState(): Promise<ClaimState | null> {
  return reward.claimState();
}

/** Can this install still type in an invite code? */
export async function canEnterCode(): Promise<boolean> {
  const [first, c] = await Promise.all([firstOpenAt(), claimState()]);
  return Date.now() - first < WINDOW && !(c && (c.result === 'ok' || c.result === 'already'));
}

/**
 * Register our code before anything else can make the server assign one. If the
 * server already holds a different code for this install, links switch to it.
 */
export async function ensureRegistered(): Promise<void> {
  if (!isOnline() || (await getJSON<boolean>(K.registered))) return;
  try {
    const r = await post<{ code: string }>('code', { code: await refCode() });
    if (!r) return;
    if (r.code && r.code !== (await refCode())) await setRefCode(r.code);
    await AsyncStorage.setItem(K.registered, 'true');
  } catch {}
}

/** On launch: register our code (first registration wins) and, on Android's first run, read the Play referrer. */
export async function bootReferrals(): Promise<void> {
  const firstRun = !(await getJSON<number>(K.first));
  await firstOpenAt();
  await ensureRegistered();
  if (await reward.pending()) retryLater(await reward.activate());
  if (firstRun && Platform.OS === 'android') {
    try {
      const { getInstallReferrerAsync } = await import('expo-application');
      const code = new URLSearchParams(await getInstallReferrerAsync()).get('r');
      if (code) await claimInvite(code, 'play_referrer');
    } catch {}
  }
}

/** Only the first successful claim counts; later ones are ignored locally. */
export async function claimInvite(raw: string, source: ClaimSource, shareId?: string): Promise<ClaimResult> {
  const code = raw.trim().toLowerCase().slice(0, 20);
  if (!code) return 'unknown_code';
  const prev = await claimState();
  if (prev && (prev.result === 'ok' || prev.result === 'already')) return 'already';
  if (code === (await refCode())) return 'self';
  const job: ClaimJob = { code, source, shareId };
  const { result, retry } = await sendClaim(job);
  if (retry) {
    // Couldn't reach the server (a card room with no signal): keep it and send it later.
    queue('invite-claim', job, 'claim');
    return 'queued';
  }
  return result;
}

interface ClaimJob {
  code: string;
  source: ClaimSource;
  shareId?: string;
}

/** retry: no signal or the server is down for now (worth sending again later). */
async function sendClaim({ code, source, shareId }: ClaimJob): Promise<{ result: ClaimResult; retry: boolean }> {
  let result: ClaimResult;
  try {
    const r = await post<{ result: ClaimResult }>('claim', { code, source, ...(shareId ? { shareId } : {}) });
    result = r ? r.result : 'disabled';
  } catch (e) {
    const status = Number((e as Error).message);
    return { result: 'error', retry: !status || status === 429 || status >= 500 };
  }
  track('invite_claimed', { source, result });
  // A first hand saved while this claim waited for signal turns the reward on now.
  if (result === 'ok' || result === 'already') retryLater(await reward.claimAccepted(code, result));
  return { result, retry: false };
}

registerSender('invite-claim', async (p) => {
  const job = p as ClaimJob;
  const prev = await claimState();
  if (prev && (prev.result === 'ok' || prev.result === 'already')) return 'drop';
  return (await sendClaim(job)).retry ? 'retry' : 'done';
});

/** After a hand is saved: if we came through an invite, turn the reward on. True when it was just granted. */
export async function activateInvite(): Promise<boolean> {
  return retryLater(await reward.handSaved()) === 'granted';
}

export interface InviteStatus {
  code: string;
  url: string;
  invited: number;
  activated: number;
  /** Pro days from invites before the discount (17 Oct). */
  daysEarned: number;
  proUntil: string | null;
  discounts: number;
  offer: InviteOffer | null;
}

/** The last invite discount the server reported, while it can still be used (for the paywall, offline too). */
export async function savedInviteOffer(): Promise<InviteOffer | null> {
  return openOffer(await getJSON<InviteOffer>(K.offer));
}

/** null when invites are switched off on the server. */
export async function inviteStatus(): Promise<InviteStatus | null> {
  try {
    await ensureRegistered();
    const s = await post<InviteStatus>('status', { myCode: await refCode() });
    if (s?.code && s.code !== (await refCode())) await setRefCode(s.code);
    if (s?.offer) await AsyncStorage.setItem(K.offer, JSON.stringify(s.offer)).catch(() => {});
    return s;
  } catch {
    return null;
  }
}

/** The code to put in a link we're about to share: registered first, so claims on it count. */
export async function shareRef(): Promise<string> {
  void markShared();
  return readyRef();
}

/** The code for a link, without counting it as sent: for shares that can still fail (mark them once they go out). */
export async function readyRef(): Promise<string> {
  // Never hold up a share on a slow network: registration is retried next time.
  await Promise.race([ensureRegistered(), new Promise((r) => setTimeout(r, 2500))]);
  return refCode();
}

/** This install has sent its code out at least once: from now on, look for friends' first hands. */
export async function markShared(): Promise<void> {
  if (await getJSON<boolean>(K.shared)) return;
  // Days counted from here: a friend's first hand after this share is news.
  await AsyncStorage.setItem(K.shared, 'true').catch(() => {});
}

/**
 * An invite discount the app hasn't announced yet: the friend's right after their first hand,
 * the inviter's on the next open. Checked at most every 6 hours (unless `force`), never offline.
 */
export async function newInviteOffer(o: { force?: boolean; now?: number } = {}): Promise<InviteOffer | null> {
  const now = o.now ?? Date.now();
  if (!isOnline()) return null;
  if (!o.force) {
    if (!(await getJSON<boolean>(K.shared))) return null;
    if (now - ((await getJSON<number>(K.checked)) ?? 0) < 6 * 3600000) return null;
    await AsyncStorage.setItem(K.checked, JSON.stringify(now)).catch(() => {});
  }
  const before = await getJSON<InviteOffer>(K.offer);
  const offer = openOffer((await inviteStatus())?.offer, now);
  return offer && offer.until !== before?.until ? offer : null;
}

// "Delete all my data": the server forgets this install's code, RevenueCat id and invites.
// The claim state stays on the phone (erase-core), so erasing never claims a reward again.
// Once gone, the code is registered again before the next shared link.
registerSender('invite-erase', async () => {
  const res = await fetch(`${API}/api/referrals/erase`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ installId: await installId() }),
  });
  if (res.ok) await AsyncStorage.removeItem(K.registered).catch(() => {});
  return outcomeOf(res.status);
});

onEraseAll(() => queue('invite-erase', {}, 'erase'));
