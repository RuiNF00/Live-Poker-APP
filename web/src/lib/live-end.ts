import 'server-only';
import { createPrivateKey, sign } from 'node:crypto';
import { connect } from 'node:http2';
import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceClient } from './supabase';

// Push-to-end (first update): a session ended on one phone ends its Live Activity on the others
// with the same recovery code (migration 20261101000000_live_end). Nothing of the session reaches
// this server or Apple: the slot is an HMAC made on the phone and the push carries no props.
//
// Needs, on the server: APNS_KEY_ID, APNS_TEAM_ID and APNS_KEY (the .p8, PEM text) from an APNs
// auth key on the Apple account; APNS_HOST is api.push.apple.com (TestFlight and the store) or
// api.sandbox.push.apple.com (development builds). Without them, ending silently does nothing and
// the app's own launch check still clears the lock screen.

export const SLOT_RE = /^[a-f0-9]{32}$/;
export const TOKEN_RE = /^[a-fA-F0-9]{16,200}$/;
const BUNDLE = process.env.APNS_BUNDLE_ID ?? 'com.ruinf.sweatbook';

interface LiveEndBackend {
  put(id: string, hash: string, slot: string, token: string): Promise<void>;
  take(id: string, hash: string, slot: string): Promise<string[]>;
}

class SupabaseLiveEnd implements LiveEndBackend {
  constructor(private db: SupabaseClient) {}
  async put(id: string, hash: string, slot: string, token: string) {
    const { error } = await this.db.rpc('put_live_end', { p_id: id, p_key_hash: hash, p_slot: slot, p_token: token });
    if (error) throw error;
  }
  async take(id: string, hash: string, slot: string) {
    const { data, error } = await this.db.rpc('take_live_end', { p_id: id, p_key_hash: hash, p_slot: slot });
    if (error) throw error;
    return ((data as { token: string }[] | null) ?? []).map((r) => r.token);
  }
}

/** Development without Supabase: in memory, which is all a local test needs. */
class MemoryLiveEnd implements LiveEndBackend {
  private rows = new Map<string, { hash: string; tokens: Set<string> }>();
  async put(id: string, hash: string, slot: string, token: string) {
    const k = `${id}:${slot}`;
    const cur = this.rows.get(k);
    if (cur && cur.hash !== hash) return;
    this.rows.set(k, { hash, tokens: new Set([...(cur?.tokens ?? []), token]) });
  }
  async take(id: string, hash: string, slot: string) {
    const k = `${id}:${slot}`;
    const cur = this.rows.get(k);
    if (!cur || cur.hash !== hash) return [];
    this.rows.delete(k);
    return [...cur.tokens];
  }
}

let backend: LiveEndBackend | null | undefined;
export function liveEnd(): LiveEndBackend | null {
  if (backend !== undefined) return backend;
  try {
    const db = serviceClient();
    backend = db ? new SupabaseLiveEnd(db) : new MemoryLiveEnd();
  } catch {
    return null;
  }
  return backend;
}

/** The APNs body that ends a Live Activity at once. No props: the layout shows only the app mark. */
export function endPayload(now = Date.now()) {
  const s = Math.floor(now / 1000);
  return { aps: { timestamp: s, event: 'end', 'dismissal-date': s, 'content-state': { name: 'SweatbookSession' } } };
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/** ES256 provider token for APNs; Apple accepts one for up to an hour. */
export function apnsJwt(keyId: string, teamId: string, pem: string, now = Date.now()): string {
  const head = b64url(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const body = b64url(JSON.stringify({ iss: teamId, iat: Math.floor(now / 1000) }));
  const sig = sign('sha256', Buffer.from(`${head}.${body}`), { key: createPrivateKey(pem), dsaEncoding: 'ieee-p1363' });
  return `${head}.${body}.${b64url(sig)}`;
}

// Apple refuses a provider token refreshed more than once every 20 minutes (429
// TooManyProviderTokenUpdates) and one older than an hour: one is reused for 50 minutes.
let cachedJwt: { key: string; jwt: string; at: number } | null = null;
export function providerToken(keyId: string, teamId: string, pem: string, now = Date.now()): string {
  const key = `${keyId}:${teamId}`;
  if (!cachedJwt || cachedJwt.key !== key || now - cachedJwt.at >= 50 * 60_000) cachedJwt = { key, jwt: apnsJwt(keyId, teamId, pem, now), at: now };
  return cachedJwt.jwt;
}

/** Sends the end to each token. Never throws: a failed end leaves the app's launch check to clear it. */
export async function sendEnds(tokens: string[]): Promise<number> {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const pem = process.env.APNS_KEY?.replace(/\\n/g, '\n');
  if (!tokens.length || !keyId || !teamId || !pem) return 0;
  const host = process.env.APNS_HOST ?? 'api.push.apple.com';
  let jwt: string;
  try {
    jwt = providerToken(keyId, teamId, pem);
  } catch (e) {
    console.warn('[live-end] key', (e as Error)?.message);
    return 0;
  }
  const client = connect(`https://${host}`);
  client.on('error', () => {});
  const body = JSON.stringify(endPayload());
  const one = (token: string) =>
    new Promise<boolean>((resolve) => {
      const req = client.request({
        ':method': 'POST',
        ':path': `/3/device/${token}`,
        authorization: `bearer ${jwt}`,
        'apns-topic': `${BUNDLE}.push-type.liveactivity`,
        'apns-push-type': 'liveactivity',
        'apns-priority': '10',
        'content-type': 'application/json',
      });
      req.setTimeout(10_000, () => req.close());
      req.on('response', (h) => resolve(h[':status'] === 200));
      req.on('error', () => resolve(false));
      req.end(body);
    });
  try {
    return (await Promise.all(tokens.map(one))).filter(Boolean).length;
  } finally {
    client.close();
  }
}
