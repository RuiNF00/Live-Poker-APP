// Push-to-end client (first update). With the cloud copy on, the Live Activity's push token is
// registered under an opaque slot (live-end-slot.ts), and any phone with the same recovery code
// that ends or deletes the session asks the server to end it. Best effort: no cloud copy, no
// network or no APNs on the server, and the app's own launch check still ends it (lock-screen).

import { BRAND } from '@/theme';

import { loadCloud } from './cloud-backup';

const API = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? BRAND.webUrl;

// The ciphers, gzip and the slot's HMAC load only when a token is sent (as in cloud-backup.ts): never at launch.
const crypto = () => import('./backup-crypto');

async function call(method: 'PUT' | 'POST', body: Record<string, string>, sessionId: string): Promise<void> {
  const c = await loadCloud();
  if (!c) return;
  const { deriveKeys, liveSlot } = await crypto();
  const { auth, enc } = deriveKeys(c.secret);
  await fetch(`${API}/api/live-end/${c.id}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-backup-key': auth },
    body: JSON.stringify({ ...body, slot: liveSlot(enc, sessionId) }),
  }).catch(() => {});
}

/** This phone's Live Activity for `sessionId` can be ended with `token` (APNs, hex). */
export function registerLiveToken(sessionId: string, token: string): Promise<void> {
  return /^[0-9a-f]{16,200}$/i.test(token) ? call('PUT', { token }, sessionId) : Promise.resolve();
}

/** The session ended or was deleted here: end its Live Activity on every phone. */
export function endLiveEverywhere(sessionId: string): Promise<void> {
  return call('POST', {}, sessionId);
}
