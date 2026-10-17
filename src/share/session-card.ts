// What a shareable session card says: three big numbers picked from the
// session (Hevy/Garmin style), a version without money for players who
// don't post amounts, and a milestone when the session earned one. Only real
// numbers from the player's own data; nothing is shown when it isn't known.

import { t } from '@/i18n';
import { replay, totalPot } from '@/poker/engine';
import { bbs, duration, money } from '@/poker/format';
import type { Hand } from '@/poker/types';
import { playedMs, profit } from '@/store/session-math';
import type { Session } from '@/store/types';

export type CardStyle = 'noite' | 'brasa' | 'sticker';
export const CARD_STYLES: CardStyle[] = ['noite', 'brasa', 'sticker'];

export interface CardStat {
  key: 'result' | 'place' | 'pot' | 'hours' | 'perHour' | 'hands' | 'venue';
  label: string;
  value: string;
  tone?: 'good' | 'bad';
}

export interface Milestone {
  kind: 'count' | 'bestResult' | 'bestMonth' | 'biggestPot';
  title: string;
  /** Second line; carries the amount, so it is dropped when money is hidden. */
  detail?: string;
  money: boolean;
}

const COUNT_MARKS = [10, 25, 50, 100, 250, 500, 1000];

/** Biggest pot of a hand, in big blinds (0 if it can't be worked out). */
export function potInBB(h: Hand): number {
  if (!h.game.bb) return 0;
  try {
    const r = replay(h);
    const pot = r.result ? r.result.pots.reduce((a, p) => a + p.amount, 0) : totalPot(r.final);
    return pot / h.game.bb;
  } catch {
    return 0;
  }
}

function biggestHand(hands: Hand[]): { hand: Hand; bb: number } | null {
  let best: { hand: Hand; bb: number } | null = null;
  for (const h of hands) {
    const bb = potInBB(h);
    if (bb > 0 && (!best || bb > best.bb)) best = { hand: h, bb };
  }
  return best;
}

/** The three numbers on the card, most telling first. */
export function sessionStats(s: Session, hands: Hand[], hideMoney: boolean, now = Date.now()): CardStat[] {
  const mine = hands.filter((h) => h.sessionId === s.id);
  const p = profit(s);
  const ms = playedMs(s, now);
  const hours = ms / 3_600_000;
  const big = biggestHand(mine);
  const all: (CardStat | null)[] = [
    hideMoney ? null : { key: 'result', label: t('Resultado'), value: (p > 0 ? '+' : '') + money(p, s.currency), tone: p > 0 ? 'good' : p < 0 ? 'bad' : undefined },
    s.kind === 'mtt' && s.finish ? { key: 'place', label: t('Lugar'), value: s.field ? `${s.finish}º/${s.field}` : `${s.finish}º` } : null,
    big ? { key: 'pot', label: t('Maior pote'), value: bbs(big.bb * (big.hand.game.bb || 1), big.hand.game.bb) } : null,
    ms > 60_000 ? { key: 'hours', label: t('A jogar'), value: duration(ms) } : null,
    !hideMoney && hours >= 1 ? { key: 'perHour', label: t('Por hora'), value: (p > 0 ? '+' : '') + money(Math.round(p / hours), s.currency), tone: p > 0 ? 'good' : p < 0 ? 'bad' : undefined } : null,
    mine.length ? { key: 'hands', label: t('Mãos registadas'), value: String(mine.length) } : null,
    s.venue ? { key: 'venue', label: t('Sala'), value: s.venue } : null,
  ];
  return all.filter((x): x is CardStat => !!x).slice(0, 3);
}

const monthKey = (ms: number) => {
  const d = new Date(ms);
  return d.getFullYear() * 12 + d.getMonth();
};

/**
 * A milestone this session reached, if any: a round number of sessions, the
 * best result or month so far (same currency, with some history behind it),
 * or the biggest pot ever logged.
 */
export function milestoneFor(s: Session, sessions: Session[], hands: Hand[]): Milestone | null {
  const done = sessions.filter((x) => x.endedAt && x.startedAt <= s.startedAt);
  if (!done.some((x) => x.id === s.id) && s.endedAt) done.push(s);
  const n = done.length;
  if (COUNT_MARKS.includes(n)) return { kind: 'count', title: t('{n}.ª sessão registada', { n }), money: false };

  const same = sessions.filter((x) => x.endedAt && x.currency === s.currency);
  const p = profit(s);
  const others = same.filter((x) => x.id !== s.id);
  if (p > 0 && others.length >= 4 && others.every((x) => profit(x) < p)) {
    return { kind: 'bestResult', title: t('Melhor sessão de sempre'), detail: '+' + money(p, s.currency), money: true };
  }

  const months = new Map<number, number>();
  for (const x of same) months.set(monthKey(x.startedAt), (months.get(monthKey(x.startedAt)) ?? 0) + profit(x));
  const mine = monthKey(s.startedAt);
  const total = months.get(mine) ?? 0;
  if (total > 0 && months.size >= 3 && [...months].every(([k, v]) => k === mine || v < total)) {
    return { kind: 'bestMonth', title: t('Melhor mês de sempre'), detail: '+' + money(total, s.currency), money: true };
  }

  const here = biggestHand(hands.filter((h) => h.sessionId === s.id));
  const before = biggestHand(hands.filter((h) => h.sessionId !== s.id && h.createdAt < (s.endedAt ?? Date.now())));
  if (here && before && here.bb > before.bb && hands.length >= 10) {
    return { kind: 'biggestPot', title: t('Maior pote de sempre'), detail: bbs(here.bb * (here.hand.game.bb || 1), here.hand.game.bb), money: false };
  }
  return null;
}
