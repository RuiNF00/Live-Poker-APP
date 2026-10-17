import 'server-only';
import { createHmac } from 'node:crypto';
import { clientIp, rateLimited } from './ratelimit';
import { serviceClient } from './supabase';

// Abuse controls that don't trust anything the client says about who it is.
// The IP is never stored: only an HMAC of it that changes every day (privacy policy).

const secret = () => process.env.ABUSE_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'local-dev-only';
const day = () => new Date().toISOString().slice(0, 10);
const hmac = (s: string) => createHmac('sha256', secret()).update(s).digest('hex');

const asUuid = (h: string) => `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;

/** Today's pseudonymous id for the caller's IP (32 hex chars). */
export const ipHash = (req: Request) => hmac(`ip:${day()}:${clientIp(req)}`).slice(0, 32);

/** Reports count distinct IPs per day, whatever reporterId the client sends. */
export const reporterId = (req: Request) => asUuid(hmac(`reporter:${day()}:${clientIp(req)}`));

/** Stable per browser id for votes, so a re-vote replaces the old one; capped per IP in SQL. */
export const voterUuid = (clientId: string) => asUuid(hmac(`voter:${clientId}`));

/**
 * True when the caller is over `max` hits per `windowSec` for this bucket. Checks this
 * instance's memory first, then a counter in the database that holds across instances.
 * The database check fails open: an outage there shouldn't take the site down.
 */
export async function limited(req: Request, bucket: string, max: number, windowSec: number): Promise<boolean> {
  if (rateLimited(`${bucket}:${clientIp(req)}`, max, windowSec * 1000)) return true;
  try {
    const db = serviceClient();
    if (!db) return false;
    const { data, error } = await db.rpc('hit_rate_limit', { p_bucket: bucket, p_key: ipHash(req), p_max: max, p_window_seconds: windowSec });
    return !error && data === true;
  } catch {
    return false;
  }
}

const seenHere = new Set<string>();

/**
 * True the first time `key` shows up in this bucket within the window (30 days by default), so the
 * team hears about the first report of each item without hearing about every one after it.
 */
export async function firstTime(bucket: string, key: string, windowSec = 30 * 86400): Promise<boolean> {
  try {
    const db = serviceClient();
    if (db) {
      const { data, error } = await db.rpc('hit_rate_limit', { p_bucket: bucket, p_key: key, p_max: 1, p_window_seconds: windowSec });
      if (!error) return data === false;
    }
  } catch {
    // fall through to this instance's memory
  }
  if (seenHere.has(`${bucket}:${key}`)) return false;
  seenHere.add(`${bucket}:${key}`);
  return true;
}
