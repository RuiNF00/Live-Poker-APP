// Free-plan counters. Pure functions over a small usage log, so they can be
// tested and the log can't be reset by deleting hands.

export type UsageKind = 'hand' | 'share';

export interface UsageEvent {
  kind: UsageKind;
  t: number;
}

function startOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function usedToday(log: UsageEvent[], kind: UsageKind, now = Date.now()): number {
  const from = startOfDay(now);
  // Saves "in the future" count too: turning the clock back must not free them up.
  return log.filter((e) => e.kind === kind && e.t >= from).length;
}

/** How many more are allowed today; `null` = unlimited. */
export function remainingToday(log: UsageEvent[], kind: UsageKind, limit: number | null, now = Date.now()): number | null {
  if (limit === null) return null;
  return Math.max(0, limit - usedToday(log, kind, now));
}

export function canUse(log: UsageEvent[], kind: UsageKind, limit: number | null, isPro: boolean, now = Date.now()): boolean {
  if (isPro) return true;
  const left = remainingToday(log, kind, limit, now);
  return left === null || left > 0;
}

/** Keep only what today's counters need, so the stored log stays tiny. */
export function pruneLog(log: UsageEvent[], now = Date.now()): UsageEvent[] {
  const from = startOfDay(now) - 86400000;
  return log.filter((e) => e.t >= from);
}

/** rl.pro.v1: the store's last answer, kept so Pro works offline. '1' Pro, '0' not, since the first Pro build. */
export const proCache = (isPro: boolean) => (isPro ? '1' : '0');
export const cachedPro = (v: string | null | undefined) => v === '1';
