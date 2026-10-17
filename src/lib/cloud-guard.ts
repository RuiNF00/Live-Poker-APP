// Rules that keep a good cloud copy from being replaced by a worse one. Pure,
// so the restore race can be tested without a phone.

import type { CloudState } from './cloud-code';

/** Everything a backup carries that the player made. Bankrolls are left out: every phone has a default one. */
const KINDS = ['hands', 'sessions', 'players', 'transfers', 'backers', 'packages', 'payments', 'trips'] as const;
type Kind = (typeof KINDS)[number];
export type Counts = Partial<Record<Kind, number>>;

const AUTO_EVERY_MS = 6 * 3600000;

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
  if (!n) return 'would_shrink';
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

/** A cloud copy older than this gets a warning (the launch auto-backup runs every 6 hours). */
export const STALE_DAYS = 7;

export type Health = { level: 'ok' } | { level: 'failed'; reason: string } | { level: 'stale'; days: number };

/**
 * Is the cloud copy keeping up? Only for players who turned it on: 'failed'
 * when the last attempt failed after the last copy that worked, 'stale' when
 * the last good copy is STALE_DAYS old or more.
 */
export function backupHealth(c: CloudState | null, now: number): Health {
  if (!c) return { level: 'ok' };
  if (c.failedAt && (!c.lastAt || c.failedAt > c.lastAt)) return { level: 'failed', reason: c.failure ?? 'network' };
  const days = c.lastAt ? Math.floor((now - c.lastAt) / 86400000) : Infinity;
  return days >= STALE_DAYS ? { level: 'stale', days } : { level: 'ok' };
}
