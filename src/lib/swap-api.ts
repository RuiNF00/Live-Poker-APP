// Client for swaps on sweatbook.poker (web/src/app/api/swaps). The proposer gets token 'a'
// when creating; the other player gets token 'b' when confirming (on the page or in the app).

import * as Crypto from 'expo-crypto';

import type { RemoteSwap, SwapEntry, SwapTerms } from '@/store/swaps';
import { variant } from '@/i18n';
import { BRAND } from '@/theme';

import { withLang } from './link-lang';

// Same server as share-api.ts (not imported from there: it pulls in more than we need).
const API = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? BRAND.webUrl;

export function swapUrl(id: string, ref?: string): string {
  return withLang(`${BRAND.webUrl}/swap/${id}${ref ? `?r=${encodeURIComponent(ref)}` : ''}`, variant);
}

/** One per draft: a create sent again with it (an automatic retry) gets the same swap back, never a second one. */
export const newCreateKey = () => Array.from(Crypto.getRandomBytes(32), (b) => b.toString(16).padStart(2, '0')).join('');
export const newCid = () => Crypto.randomUUID().replace(/-/g, '').slice(0, 16);

export class SwapError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

async function call(path: string, init: RequestInit & { token?: string } = {}): Promise<{ swap?: RemoteSwap; token?: string; id?: string }> {
  const { token, ...rest } = init;
  const res = await fetch(`${API}/api/swaps${path}`, {
    ...rest,
    headers: { 'content-type': 'application/json', ...(token ? { 'x-edit-token': token } : {}) },
  });
  const j = (await res.json().catch(() => ({}))) as { swap?: RemoteSwap; token?: string; id?: string; error?: string; accounts?: boolean };
  if (!res.ok) throw new SwapError(j.error ?? 'http_' + res.status, res.status);
  if (j.swap && typeof j.accounts === 'boolean') j.swap = { ...j.swap, accounts: j.accounts };
  return j;
}

/** `rcUserId`: my RevenueCat id, so the swap's accounts follow my Pro for both players. */
export async function createSwap(terms: SwapTerms, rcUserId?: string, key?: string): Promise<{ swap: RemoteSwap; token: string }> {
  const j = await call('', { method: 'POST', body: JSON.stringify({ terms, rcUserId, token: key }) });
  if (!j.swap || !j.token) throw new SwapError('bad_response', 500);
  return { swap: j.swap, token: j.token };
}

/** Null when it no longer exists (deleted by one of the players, or never confirmed and expired). */
export async function fetchSwap(id: string, token?: string): Promise<RemoteSwap | null> {
  try {
    return (await call(`/${encodeURIComponent(id)}`, { token })).swap ?? null;
  } catch (e) {
    if (e instanceof SwapError && e.status === 404) return null;
    throw e;
  }
}

export async function confirmSwap(id: string, name: string): Promise<{ swap: RemoteSwap; token: string }> {
  const j = await call(`/${encodeURIComponent(id)}/confirm`, { method: 'POST', body: JSON.stringify({ name }) });
  if (!j.swap || !j.token) throw new SwapError('bad_response', 500);
  return { swap: j.swap, token: j.token };
}

export async function addSwapEntry(id: string, token: string, e: Pick<SwapEntry, 'cid' | 'kind' | 'amount' | 'event' | 'finish'>): Promise<RemoteSwap> {
  const j = await call(`/${encodeURIComponent(id)}/entries`, { method: 'POST', token, body: JSON.stringify({ entry: e }) });
  if (!j.swap) throw new SwapError('bad_response', 500);
  return j.swap;
}

export async function removeSwapEntry(id: string, token: string, entryId: string): Promise<RemoteSwap> {
  const j = await call(`/${encodeURIComponent(id)}/entries/${encodeURIComponent(entryId)}`, { method: 'DELETE', token });
  if (!j.swap) throw new SwapError('bad_response', 500);
  return j.swap;
}

/** The creator's RevenueCat id changed (a reinstall or a restore): the new one replaces it. */
export async function setSwapOwnerRc(id: string, token: string, rcUserId: string): Promise<void> {
  await call(`/${encodeURIComponent(id)}`, { method: 'PATCH', token, body: JSON.stringify({ rcUserId }) });
}

/** `leave` ("Delete all my data"): only my side goes; the other player keeps a read-only record. */
export async function deleteSwap(id: string, token: string, leave = false): Promise<void> {
  try {
    await call(`/${encodeURIComponent(id)}${leave ? '?leave=1' : ''}`, { method: 'DELETE', token });
  } catch (e) {
    if (!(e instanceof SwapError && e.status === 404)) throw e;
  }
}
