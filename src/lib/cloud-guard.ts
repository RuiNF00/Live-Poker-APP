// Rules that keep a good cloud copy from being replaced by a worse one. Pure,
// so the restore race can be tested without a phone.

import type { CloudState } from './cloud-code';

export interface Counts {
  hands: number;
  sessions: number;
  players: number;
}

const AUTO_EVERY_MS = 6 * 3600000;

export function countsOf(d: { hands: unknown[]; sessions: unknown[]; players: unknown[] }): Counts {
  return { hands: d.hands.length, sessions: d.sessions.length, players: d.players.length };
}

/**
 * Null when the upload may replace the server copy, else 'would_shrink'.
 * Blocks an empty phone (a restore not loaded yet looks exactly like that) and
 * any phone holding fewer hands, sessions or players than the cloud copy had
 * after the last upload or restore. Only an explicit choice (force) overrides.
 */
export function uploadBlock(data: Counts, c: CloudState, force = false): 'would_shrink' | null {
  if (force) return null;
  if (!data.hands && !data.sessions && !data.players) return 'would_shrink';
  const k = c.counts;
  if (k && (data.hands < k.hands || data.sessions < k.sessions || data.players < k.players)) return 'would_shrink';
  return null;
}

/**
 * The player deleted one item on purpose: the cloud copy may now hold one more
 * than the phone without anything being lost, so the next backup can go out.
 */
export function afterDelete(c: CloudState, kind: keyof Counts): CloudState {
  if (!c.counts) return c;
  return { ...c, counts: { ...c.counts, [kind]: Math.max(0, c.counts[kind] - 1) } };
}

/** What the launch auto-backup does: nothing, or upload. It never forces. */
export function autoBackup(c: CloudState | null, data: Counts, now: number): 'skip' | 'upload' {
  if (!c || (c.lastAt && now - c.lastAt < AUTO_EVERY_MS)) return 'skip';
  return uploadBlock(data, c) ? 'skip' : 'upload';
}
