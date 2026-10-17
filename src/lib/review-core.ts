// When the app may ask for a store review (design/pedido-avaliacao.md §3).
// Pure, so it can be tested; review.ts keeps the state on the phone and asks.

export type ReviewMoment = 'share3' | 'month' | 'settled';

export interface ReviewState {
  installedAt: number;
  /** Distinct days the app was opened (YYYY-MM-DD), only the first few are kept. */
  days: string[];
  /** When the review prompt was requested. */
  asks: number[];
  /** App versions it was requested in. */
  versions: string[];
  paywallAt?: number;
  cancelAt?: number;
  /** Trial started or Pro bought. */
  boughtAt?: number;
}

export interface ReviewNow {
  now: number;
  version: string;
  hands: number;
  /** A live session, paused or not. */
  live: boolean;
  /** A session that ended in the last 24 h with a loss (or a bust). */
  recentLoss: boolean;
  /** A sync, share or purchase error was shown since the app opened. */
  error: boolean;
  /** A sheet, alert or the notification ask is on screen. */
  overlay: boolean;
}

const H = 3_600_000;
const D = 24 * H;

export const MIN_DAYS_INSTALLED = 3;
export const MIN_DAYS_USED = 3;
export const MIN_HANDS = 5;
export const GAP = 120 * D;
export const PER_YEAR = 3;

export const dayKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Record an app open; keeps at most MIN_DAYS_USED distinct days, enough to know. */
export function noteDay(s: ReviewState, now: number): ReviewState {
  const k = dayKey(now);
  if (s.days.includes(k) || s.days.length >= MIN_DAYS_USED) return s;
  return { ...s, days: [...s.days, k] };
}

/** Why not now, or null when the prompt may be requested. */
export function blockReason(s: ReviewState, n: ReviewNow): string | null {
  if (n.now - s.installedAt < MIN_DAYS_INSTALLED * D) return 'new-install';
  if (s.days.length < MIN_DAYS_USED) return 'few-days';
  if (n.hands < MIN_HANDS) return 'few-hands';
  if (n.live) return 'live-session';
  if (n.recentLoss) return 'recent-loss';
  if (s.paywallAt && n.now - s.paywallAt < D) return 'paywall';
  if (s.cancelAt && n.now - s.cancelAt < 30 * D) return 'cancel';
  if (s.boughtAt && n.now - s.boughtAt < 48 * H) return 'bought';
  if (n.error) return 'error';
  if (n.overlay) return 'overlay';
  if (s.versions.includes(n.version)) return 'this-version';
  const last = Math.max(0, ...s.asks);
  if (last && n.now - last < GAP) return 'gap';
  if (s.asks.filter((a) => n.now - a < 365 * D).length >= PER_YEAR) return 'year';
  return null;
}

export function noteAsk(s: ReviewState, n: Pick<ReviewNow, 'now' | 'version'>): ReviewState {
  return { ...s, asks: [...s.asks, n.now].slice(-PER_YEAR), versions: [...s.versions, n.version].slice(-10) };
}
