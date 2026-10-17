// One fixed link per backer (sweatbook.poker/b#s=<id>.<key>), sent once. The app
// keeps the page current as sessions, pieces and payments change (BackerPageSync).
// The server stores it sealed (sealed-link.ts): the key is only in the link.

import * as Crypto from 'expo-crypto';

import { seal, sealedFragment, b64url, type Sealed } from './sealed-link';
import { outcomeOf, queue, registerSender } from './sync';
import { BRAND } from '@/theme';

// Same server as live-link.ts.
const API = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? BRAND.webUrl;

export interface BackerPage {
  id: string;
  /** Edit token (64 hex): only its hash is on the server. */
  token: string;
  /** AES key, base64url: only in the link and on this phone. */
  key: string;
}

export const newPageKey = () => b64url(Crypto.getRandomBytes(32));
export const sealPage = (data: unknown, page: Pick<BackerPage, 'id' | 'key'>): Sealed => seal(data, page.id, page.key, Crypto.getRandomBytes(12));

/** `ref`: the player's invite code, as on every shared link. */
export function backerPageUrl(page: Pick<BackerPage, 'id' | 'key'>, ref?: string): string {
  return `${BRAND.webUrl}/b${ref ? `?r=${encodeURIComponent(ref)}` : ''}#${sealedFragment(page.id, page.key)}`;
}

/**
 * Makes the page. The id comes from the server and the seal binds it, so the first
 * create carries an empty page (nothing to read) and the sync fills it right after.
 * `token`: the app's own (create-key.ts), so a create sent again returns the same page.
 */
export async function createBackerPage(token: string): Promise<{ id: string; token: string }> {
  const res = await fetch(`${API}/api/backer-pages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error('page ' + res.status);
  const j = await res.json();
  return { id: j.id, token: j.token };
}

/** False when the page is gone (removed, or purged): stop sending. */
export async function updateBackerPage(page: BackerPage, sealed: Sealed): Promise<boolean> {
  const res = await fetch(`${API}/api/backer-pages/${encodeURIComponent(page.id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-edit-token': page.token },
    body: JSON.stringify({ sealed }),
  });
  if (res.status === 404 || res.status === 403) return false;
  if (!res.ok) throw new Error('page ' + res.status);
  return true;
}

async function deleteBackerPage(page: Pick<BackerPage, 'id' | 'token'>): Promise<void> {
  const res = await fetch(`${API}/api/backer-pages/${encodeURIComponent(page.id)}`, {
    method: 'DELETE',
    headers: { 'x-edit-token': page.token },
  });
  if (!res.ok && res.status !== 404) throw new Error('page ' + res.status);
}

/** The page goes for the backer too: now, or when the signal is back. */
export function queueBackerPageDelete(page: Pick<BackerPage, 'id' | 'token'>) {
  queue('backer-page-delete', { id: page.id, token: page.token }, page.id);
}

registerSender('backer-page-delete', async (p) => {
  try {
    await deleteBackerPage(p as { id: string; token: string });
    return 'done';
  } catch (e) {
    const m = /^page (\d+)$/.exec((e as Error)?.message ?? '');
    return m ? outcomeOf(Number(m[1])) : 'retry';
  }
});
