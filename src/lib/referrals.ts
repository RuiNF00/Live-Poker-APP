// Invites: a friend who arrives through your link and saves a first hand gets
// you both 7 days of Pro (granted server-side through RevenueCat). The code is
// this install's referral code (the `r=` on shared links).
// Every call fails quietly: invites are a bonus, never in the way.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { appUserId } from '@/billing/purchases';
import { BRAND } from '@/theme';

import { installId, refCode, setRefCode, track } from './events';

const API = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? BRAND.webUrl;
const K = { first: 'rl.first.v1', registered: 'rl.ref.reg.v1', claim: 'rl.claim.v1' };
const WINDOW = 7 * 86400000;

export type ClaimSource = 'share' | 'story' | 'link' | 'manual' | 'play_referrer';
export type ClaimResult = 'ok' | 'already' | 'unknown_code' | 'self' | 'too_late' | 'error' | 'disabled';
interface ClaimState {
  code: string;
  result: ClaimResult;
  activated?: boolean;
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T | null> {
  const res = await fetch(`${API}/api/referrals/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ installId: await installId(), rcUserId: await appUserId(), ...body }),
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

export async function claimState(): Promise<ClaimState | null> {
  return getJSON<ClaimState>(K.claim);
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
  if (await getJSON<boolean>(K.registered)) return;
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
  let result: ClaimResult;
  try {
    const r = await post<{ result: ClaimResult }>('claim', { code, source, ...(shareId ? { shareId } : {}) });
    result = r ? r.result : 'disabled';
  } catch {
    result = 'error';
  }
  if (result === 'ok' || result === 'already') await AsyncStorage.setItem(K.claim, JSON.stringify({ code, result })).catch(() => {});
  track('invite_claimed', { source, result });
  return result;
}

/** After a hand is saved: if we came through an invite, turn the reward on. True when it was just granted. */
export async function activateInvite(): Promise<boolean> {
  const c = await claimState();
  if (!c || c.result !== 'ok' || c.activated) return false;
  try {
    const r = await post<{ status: string }>('activate', {});
    if (!r) return false;
    await AsyncStorage.setItem(K.claim, JSON.stringify({ ...c, activated: true })).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

export interface InviteStatus {
  code: string;
  url: string;
  invited: number;
  activated: number;
  daysEarned: number;
  proUntil: string | null;
}

/** null when invites are switched off on the server. */
export async function inviteStatus(): Promise<InviteStatus | null> {
  try {
    await ensureRegistered();
    const s = await post<InviteStatus>('status', { myCode: await refCode() });
    if (s?.code && s.code !== (await refCode())) await setRefCode(s.code);
    return s;
  } catch {
    return null;
  }
}

/** The code to put in a link we're about to share: registered first, so claims on it count. */
export async function shareRef(): Promise<string> {
  await ensureRegistered();
  return refCode();
}
