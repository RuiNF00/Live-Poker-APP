// Rules that keep a good cloud copy from being replaced by a worse one. Pure,
// so the restore race can be tested without a phone.

import type { CloudState } from './cloud-code';

/** Everything a backup carries that the player made. Bankrolls are left out: every phone has a default one. */
const KINDS = ['hands', 'sessions', 'players', 'transfers', 'backers', 'packages', 'payments', 'trips'] as const;
type Kind = (typeof KINDS)[number];
export type Counts = Partial<Record<Kind, number>>;

const AUTO_EVERY_MS = 6 * 3600000;

/** Same as BACKUP_MAX_BYTES on the server. */
export const BACKUP_MAX_BYTES = 2 * 1024 * 1024;
/** From this share of the limit the player is told before a copy stops fitting. */
export const NEAR_LIMIT = 0.8;

export function countsOf(d: Partial<Record<Kind, unknown[]>>): Counts {
  const out: Counts = {};
  for (const k of KINDS) out[k] = d[k]?.length ?? 0;
  return out;
}

const total = (c: Counts) => KINDS.reduce((n, k) => n + (c[k] ?? 0), 0);

/**
 * Null when the upload may replace the server copy, else 'would_shrink'.
 * Blocks an empty phone (a restore not loaded yet looks exactly like that) and
 * one holding less than half of what the cloud copy had after the last upload
 * or restore. Deleting a few things on purpose stays well above that line.
 * Only an explicit choice (force) overrides.
 */
export function uploadBlock(data: Counts, c: CloudState, force = false): 'would_shrink' | null {
  if (force) return null;
  const n = total(data);
  // An empty phone may be a restore not loaded yet, unless the cloud copy is empty too (just turned on).
  if (!n) return c.counts && !total(c.counts) ? null : 'would_shrink';
  if (c.counts && n * 2 < total(c.counts)) return 'would_shrink';
  return null;
}

/**
 * The "Cópia parada" warning: uploads are blocked and the cloud really holds a
 * copy this phone wrote or restored. A first backup of an empty phone is just
 * waiting for something to copy.
 */
export function cloudAhead(data: Counts, c: CloudState): boolean {
  return !!c.lastAt && !!uploadBlock(data, c);
}

/** What the launch auto-backup does: nothing, or upload. It never forces. */
export function autoBackup(c: CloudState | null, data: Counts, now: number): 'skip' | 'upload' {
  if (!c || (c.lastAt && now - c.lastAt < AUTO_EVERY_MS)) return 'skip';
  return uploadBlock(data, c) ? 'skip' : 'upload';
}

/** After a saved hand or a closed session, the copy waits this long for the next change... */
export const CHANGE_DEBOUNCE_MS = 30_000;
/** ...and goes out at most this often (a live session saves hand after hand). */
export const CHANGE_GAP_MS = 10 * 60_000;

/**
 * When to copy after something changed: ms to wait, or null (no copy, or one
 * that can't go out now). Never forces; a copy over the server limit goes back
 * to the 6-hourly try, not one per hand.
 */
export function changeBackupIn(c: CloudState | null, data: Counts, now: number): number | null {
  if (!c || uploadBlock(data, c)) return null;
  const tooBig = c.failure === 'too_big' && !!c.failedAt && (!c.lastAt || c.failedAt > c.lastAt);
  const at = tooBig ? c.failedAt! + AUTO_EVERY_MS : (c.lastAt ?? 0) + CHANGE_GAP_MS;
  return Math.max(CHANGE_DEBOUNCE_MS, at - now);
}

/** A cloud copy older than this gets a warning (the launch auto-backup runs every 6 hours). */
export const STALE_DAYS = 7;

export type Health = { level: 'ok' } | { level: 'failed'; reason: string } | { level: 'stale'; days: number } | { level: 'near'; pct: number };

/**
 * Is the cloud copy keeping up? Only for players who turned it on: 'failed'
 * when the last attempt failed after the last copy that worked, 'stale' when
 * the last good copy is STALE_DAYS old or more, 'near' when the last copy
 * used NEAR_LIMIT of the server limit or more (time to export to a file).
 */
export function backupHealth(c: CloudState | null, now: number): Health {
  if (!c) return { level: 'ok' };
  if (c.failedAt && (!c.lastAt || c.failedAt > c.lastAt)) return { level: 'failed', reason: c.failure ?? 'network' };
  const days = c.lastAt ? Math.floor((now - c.lastAt) / 86400000) : Infinity;
  if (days >= STALE_DAYS) return { level: 'stale', days };
  const used = (c.bytes ?? 0) / BACKUP_MAX_BYTES;
  // Floored so it never reads 100 % while the copy still fits.
  return used >= NEAR_LIMIT ? { level: 'near', pct: Math.min(99, Math.floor(used * 100)) } : { level: 'ok' };
}

/** The server deletes a copy not updated for 18 months: the notice goes out a month before. */
export const EXPIRY_WARN_MS = 17 * 30 * 86400000;

/** When that notice goes out for this copy, or null (nothing copied yet). */
export function expiryWarnAt(c: Pick<CloudState, 'lastAt'> | null): number | null {
  return c?.lastAt ? c.lastAt + EXPIRY_WARN_MS : null;
}
