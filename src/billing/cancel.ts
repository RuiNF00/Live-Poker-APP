// The cancel flow: one reason, one matching offer, and the store's cancel
// button always on screen. Rules from the Mobbin notes: no "Outro", what the
// player would lose shown with their own numbers, never a blocked exit.

import { totals } from '@/store/session-math';

export type CancelReason = 'notPlaying' | 'bankroll' | 'noSubscription' | 'feature' | 'slow' | 'otherApp';

/** In this order on screen. Portuguese keys; show with t(). */
export const CANCEL_REASONS: { key: CancelReason; icon: string; label: string }[] = [
  { key: 'notPlaying', icon: 'airplane-outline', label: 'Não estou a jogar live agora' },
  { key: 'bankroll', icon: 'wallet-outline', label: 'Não cabe no meu bankroll agora' },
  { key: 'feature', icon: 'construct-outline', label: 'Falta-me uma funcionalidade' },
  { key: 'slow', icon: 'timer-outline', label: 'Registar à mesa é lento' },
  { key: 'otherApp', icon: 'swap-horizontal-outline', label: 'Encontrei outra app' },
];

const NO_SUBSCRIPTION = { key: 'noSubscription' as const, icon: 'repeat-outline', label: 'Não quero uma subscrição' };

/** The reasons on screen. "Não quero uma subscrição" only when there's a one-time Pro to offer for it. */
export function cancelReasons(lifetime: boolean): typeof CANCEL_REASONS {
  return lifetime ? [...CANCEL_REASONS.slice(0, 2), NO_SUBSCRIPTION, ...CANCEL_REASONS.slice(2)] : CANCEL_REASONS;
}

export interface Logged {
  sessions: number;
  hands: number;
  /** Net result of the finished sessions in the main currency. */
  profit: number;
  currency: string;
  /** Earliest session or hand. */
  since: number;
}

/** What is in the player's notebook, or null when there's nothing to show. */
export function logged(
  hands: { createdAt: number }[],
  sessions: Parameters<typeof totals>[0],
): Logged | null {
  if (!hands.length && !sessions.length) return null;
  const tot = totals(sessions);
  const since = Math.min(...hands.map((h) => h.createdAt), ...sessions.map((s) => s.startedAt));
  return { sessions: sessions.length, hands: hands.length, profit: tot.profit, currency: tot.currency, since };
}
