// What a festival recap card says: days at the tables, events played, cashes,
// the best hand of the trip and the result in buy-ins (or big blinds for a
// cash-only trip), so the card is worth posting without a single amount on
// it. Money only shows when the player turns it on. Only the trip's own name
// goes on the card: never the venue (no casino or event brand in a share).

import { decimalComma, t, variant } from '@/i18n';
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
  /** A festival's trip; false for a trip the player made by hand (trip wording on the card). */
  festival: boolean;
  from: number;
  to: number;
  days: number;
  /** Local days played, as dayKey(). */
  played: Set<string>;
  /** Days a tournament paid out (the day it ended), as dayKey(). */
  cashedOn: Set<string>;
  events: number;
  cashSessions: number;
  /** Tournaments that paid (prize above 0). */
  cashes: number;
  best: { finish: number; field?: number } | null;
  /** Result in buy-ins (any tournament) or big blinds (cash only); null when it can't be worked out. */
  result: { value: number; unit: 'bi' | 'bb' } | null;
  /** Poker result in the trip's currency (sessions in a currency with no rate left out). Trip
   *  expenses (flight, hotel) are not in it: the card is about the poker, like the buy-ins. */
  money: number;
  currency: string;
  bestHand: BestHand | null;
}

const DAY_GAP = 6 * 3_600_000;
const DAY_MS = 86_400_000;
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
    festival: !!trip.festivalId,
    from: trip.from,
    to: trip.to,
    days: played.size,
    played,
    cashedOn: new Set(mtts.filter((s) => (s.cashOut || 0) > 0).map((s) => dayKey(s.endedAt ?? s.startedAt))),
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

/** "14.º" in pt-PT and es, "14º" in pt-BR, "14th" in English. */
export function ordinal(n: number): string {
  if (variant === 'en') {
    const tens = n % 100;
    const suffix = tens >= 11 && tens <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
    return `${n}${suffix}`;
  }
  return variant === 'pt-BR' ? `${n}º` : `${n}.º`;
}
export const placeLabel = (finish: number, field?: number) => (field ? `${ordinal(finish)}/${field}` : ordinal(finish));

const one = (n: number) => {
  const r = Math.round(n * 10) / 10;
  const v = Math.abs(r) >= 100 ? String(Math.round(r)) : String(r);
  return decimalComma ? v.replace('.', ',') : v;
};

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
    r.best ? { key: 'place', label: t('Melhor lugar'), value: placeLabel(r.best.finish, r.best.field) } : null,
    r.cashSessions ? { key: 'cash', label: t('Sessões de cash'), value: String(r.cashSessions) } : null,
  ];
  return all.filter((x): x is RecapStat => !!x).slice(0, 4);
}

export interface EventRow {
  id: string;
  name: string;
  /** Start day, as a timestamp. */
  day: number;
  finish?: number;
  field?: number;
  cashed: boolean;
  /** Result in the player's own buy-ins for this event. */
  bi: number | null;
  /** Result in the trip's currency, shown only when the player turns amounts on. */
  money: number;
}

/** The tournaments of the trip for the carousel: the `max` best by result, in the order they were played. */
export function eventRows(trip: Trip, sessions: Session[], max = 6): EventRow[] {
  const rows: EventRow[] = tripSessions(trip, sessions)
    .filter((s) => s.kind === 'mtt' && toTripCurrency(0, s.currency, trip) !== null)
    .map((s) => {
      const own = s.buyIn * (1 - soldShare(s));
      return {
        id: s.id,
        name: s.name || t('Torneio'),
        day: s.startedAt,
        finish: s.finish,
        field: s.field,
        cashed: (s.cashOut || 0) > 0,
        bi: own > 0 ? profit(s) / own : null,
        money: toTripCurrency(profit(s), s.currency, trip) ?? 0,
      };
    });
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (b.r.bi ?? b.r.money) - (a.r.bi ?? a.r.money))
    .slice(0, max)
    .sort((a, b) => a.r.day - b.r.day || a.i - b.i)
    .map((x) => x.r);
}

/** "+3,4 bi" for an event row. */
export function biLabel(v: number): string {
  return `${resultParts({ value: v, unit: 'bi' }).num} bi`;
}

/**
 * The post's caption: the festival in one line, then the invite link. Instagram
 * doesn't take a caption from another app, so the player pastes it. Amounts only
 * when the player turned them on.
 */
export function carouselCaption(r: FestivalRecap, link: string, opts: { showResult: boolean; showMoney: boolean }): string {
  const bits: string[] = [];
  if (r.events) bits.push(r.events === 1 ? t('1 evento') : t('{n} eventos', { n: r.events }));
  if (r.events) bits.push(t('{c}/{n} nos prémios', { c: r.cashes, n: r.events }));
  if (r.best) bits.push(t('melhor lugar {p}', { p: placeLabel(r.best.finish, r.best.field) }));
  bits.push(r.days === 1 ? t('1 dia de jogo') : t('{n} dias de jogo', { n: r.days }));
  const lines = [`${r.title}: ${bits.join(', ')}.`];
  if (opts.showResult && r.result) lines.push(t('Resultado: {v}', { v: resultLabel(r.result) + (opts.showMoney ? ` (${moneyLabel(r)})` : '') }));
  else if (opts.showResult && opts.showMoney) lines.push(t('Resultado: {v}', { v: moneyLabel(r) }));
  lines.push(t('Registo as mãos e as sessões ao vivo com a Sweatbook: {link}', { link }));
  return lines.join('\n');
}

/** Monday-first weeks covering the trip; null pads the days outside it. */
export function tripWeeks(from: number, to: number): (number | null)[][] {
  const start = new Date(from);
  start.setHours(12, 0, 0, 0);
  const end = new Date(to);
  end.setHours(12, 0, 0, 0);
  const days: (number | null)[] = Array((start.getDay() + 6) % 7).fill(null);
  for (let ms = start.getTime(); ms <= end.getTime() && days.length < 42; ms += DAY_MS) days.push(ms);
  while (days.length % 7) days.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

export type SlideKind = 'summary' | 'hand' | 'events' | 'days' | 'close';

/** The slides that have something to show, in order. The closing slide is the brand, so it goes when the brand does. */
export function carouselSlides(r: FestivalRecap, events: EventRow[], opts: { showHand: boolean; brand: boolean }): SlideKind[] {
  const out: SlideKind[] = ['summary'];
  if (opts.showHand && r.bestHand) out.push('hand');
  if (events.length) out.push('events');
  out.push('days');
  if (opts.brand) out.push('close');
  return out;
}
