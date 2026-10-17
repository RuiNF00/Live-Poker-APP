// What a festival recap card says: days at the tables, events played, cashes,
// the best hand of the trip and the result in buy-ins (or big blinds for a
// cash-only trip), so the card is worth posting without a single amount on
// it. Money only shows when the player turns it on. Only the trip's own name
// goes on the card: never the venue (no casino or event brand in a share).

import { locale, t } from '@/i18n';
import { replay } from '@/poker/engine';
import { rawMoney } from '@/poker/format';
import type { Hand } from '@/poker/types';
import { profit, soldShare } from '@/store/session-math';
import { toTripCurrency, tripSessions } from '@/store/trip-math';
import type { Session, Trip } from '@/store/types';

export interface RecapStat {
  key: 'days' | 'events' | 'cashes' | 'place' | 'cash';
  label: string;
  value: string;
  tone?: 'good';
}

export interface BestHand {
  hand: Hand;
  /** Hero's net in big blinds (positive). */
  bb: number;
  /** "Full house", when the hand went to showdown. */
  made: string | null;
}

export interface FestivalRecap {
  title: string;
  from: number;
  to: number;
  days: number;
  /** Local days played, as dayKey(). */
  played: Set<string>;
  events: number;
  cashSessions: number;
  /** Tournaments that paid (prize above 0). */
  cashes: number;
  best: { finish: number; field?: number } | null;
  /** Result in buy-ins (any tournament) or big blinds (cash only); null when it can't be worked out. */
  result: { value: number; unit: 'bi' | 'bb' } | null;
  /** Poker result in the trip's currency (sessions in a currency with no rate left out). */
  money: number;
  currency: string;
  bestHand: BestHand | null;
}

const DAY_GAP = 6 * 3_600_000;
export const dayKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** Days at the tables: every day a session started on, plus each Day 2+ of a bagged tournament (an overnight break). */
function daysPlayed(list: Session[]): Set<string> {
  const days = new Set<string>();
  for (const s of list) {
    days.add(dayKey(s.startedAt));
    for (const b of s.breaks) if (b.end && b.end - b.start >= DAY_GAP) days.add(dayKey(b.end));
  }
  return days;
}

/** Hero's biggest win of the trip, in big blinds. */
export function bestHandOf(hands: Hand[]): BestHand | null {
  let best: BestHand | null = null;
  for (const h of hands) {
    if (!h.game.bb) continue;
    try {
      const r = replay(h).result;
      if (!r?.resolved) continue;
      const bb = r.net[h.hero] / h.game.bb;
      if (bb > 0 && (!best || bb > best.bb)) best = { hand: h, bb, made: r.handNames[h.hero] ?? null };
    } catch {
      // A hand that doesn't replay (still being written) just isn't a candidate.
    }
  }
  return best;
}

export function festivalRecap(trip: Trip, sessions: Session[], hands: Hand[]): FestivalRecap {
  const list = tripSessions(trip, sessions).filter((s) => toTripCurrency(0, s.currency, trip) !== null);
  const ids = new Set(list.map((s) => s.id));
  const mtts = list.filter((s) => s.kind === 'mtt');
  const cash = list.filter((s) => s.kind !== 'mtt');
  const money = list.reduce((a, s) => a + (toTripCurrency(profit(s), s.currency, trip) ?? 0), 0);

  let best: FestivalRecap['best'] = null;
  for (const s of mtts) if (s.finish && (!best || s.finish < best.finish)) best = { finish: s.finish, field: s.field };

  let result: FestivalRecap['result'] = null;
  // The player's own buy-in: the part of the action not sold.
  const own = mtts.map((s) => toTripCurrency(s.buyIn * (1 - soldShare(s)), s.currency, trip) ?? 0).filter((x) => x > 0);
  if (own.length) {
    result = { value: money / (own.reduce((a, x) => a + x, 0) / own.length), unit: 'bi' };
  } else if (cash.length && cash.every((s) => s.bb > 0)) {
    result = { value: cash.reduce((a, s) => a + profit(s) / s.bb, 0), unit: 'bb' };
  }

  const played = daysPlayed(list);
  return {
    title: trip.name || t('Festival'),
    from: trip.from,
    to: trip.to,
    days: played.size,
    played,
    events: mtts.length,
    cashSessions: cash.length,
    cashes: mtts.filter((s) => (s.cashOut || 0) > 0).length,
    best,
    result,
    money,
    currency: trip.currency,
    bestHand: bestHandOf(hands.filter((h) => h.sessionId && ids.has(h.sessionId))),
  };
}

/** One decimal in the player's language: "4,2" in Portuguese and Spanish, "4.2" in English. */
const one = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 1 }).format(Math.round(n * 10) / 10);

/** The result split for the card: a big number and its unit ("+4,2", "buy-ins"). */
export function resultParts(r: NonNullable<FestivalRecap['result']>): { num: string; unit: string } {
  const sign = r.value > 0.05 ? '+' : r.value < -0.05 ? '−' : '';
  const v = Math.abs(r.value);
  if (r.unit === 'bb') return { num: `${sign}${Math.round(v)}`, unit: 'bb' };
  return { num: `${sign}${one(v)}`, unit: Math.round(v * 10) === 10 ? 'buy-in' : 'buy-ins' };
}

/** "+4,2 buy-ins" or "+86 bb". */
export function resultLabel(r: NonNullable<FestivalRecap['result']>): string {
  const p = resultParts(r);
  return `${p.num} ${p.unit}`;
}

export function moneyLabel(r: FestivalRecap): string {
  return (r.money > 0 ? '+' : '') + rawMoney(Math.round(r.money), r.currency);
}

/** The four small numbers under the result, most telling first. */
export function recapStats(r: FestivalRecap): RecapStat[] {
  const all: (RecapStat | null)[] = [
    { key: 'days', label: t('Dias de jogo'), value: String(r.days) },
    r.events ? { key: 'events', label: r.events === 1 ? t('Evento') : t('Eventos'), value: String(r.events) } : null,
    r.events ? { key: 'cashes', label: t('Prémios'), value: `${r.cashes}/${r.events}`, tone: r.cashes ? 'good' : undefined } : null,
    r.best ? { key: 'place', label: t('Melhor lugar'), value: r.best.field ? `${r.best.finish}º/${r.best.field}` : `${r.best.finish}º` } : null,
    r.cashSessions ? { key: 'cash', label: t('Sessões de cash'), value: String(r.cashSessions) } : null,
  ];
  return all.filter((x): x is RecapStat => !!x).slice(0, 4);
}
