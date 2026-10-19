// Tournament results for the player who travels for them: ROI and ITM by
// buy-in, by festival (trip) and by game, finishes, re-entries, bounties and
// the biggest scores. Pure, and built on session-math so "your result" is the
// same number the Bankroll tab shows.
//
// Two views: `mine` is your result after staking, swaps, makeup and expenses
// (profit over your share of the buy-ins, as in totals()); `action` is the whole action as played,
// buy-ins against prizes, before any of that.

import { inRange } from './bankroll-math';
import { isBagged } from './multi-day';
import { cost, gross, mainCurrency, ownBuyIns, profit, soldShare } from './session-math';
import type { Session, Trip } from './types';

export type StatsView = 'mine' | 'action';

/** Fewer tournaments than this and ROI is mostly noise: the screen says so instead of showing it as a verdict. */
export const MIN_SAMPLE = 10;
/** A row in a breakdown needs at least this many to show its ROI. */
export const MIN_GROUP = 5;

/** Buy-in bands for one entry, in the session's currency. Upper bound exclusive. */
export const BANDS: { key: string; from: number; to: number }[] = [
  { key: '< 1k', from: 0, to: 1000 },
  { key: '1k–3k', from: 1000, to: 3000 },
  { key: '3k–10k', from: 3000, to: 10000 },
  { key: '10k–25k', from: 10000, to: 25000 },
  { key: '25k+', from: 25000, to: Infinity },
];

export type Game = 'NLH' | 'PLO' | 'Mix';

/** The game from the tournament's name: festivals name them "PLO", "8-Game", "H.O.R.S.E."… No game named means hold'em. */
export function gameOf(name: string): Game {
  if (/\b(mix(ed)?|h\.?o\.?r\.?s\.?e\.?|[0-9]+[- ]?game|dealer'?s? choice|stud|razz|2-7|triple draw|badugi|o\.?e\.?)\b/i.test(name)) return 'Mix';
  if (/\b(plo\d?|omaha|pot[- ]limit omaha|big o)\b/i.test(name)) return 'PLO';
  return 'NLH';
}

export function bandOf(buyIn: number): string {
  return (BANDS.find((b) => buyIn >= b.from && buyIn < b.to) ?? BANDS[0]).key;
}

/** Finished tournaments in one currency: bagged ones wait for their last day and don't count yet. */
export function finishedTourneys(sessions: Session[], currency?: string): { currency: string; list: Session[] } {
  const done = sessions.filter((s) => s.kind === 'mtt' && s.endedAt && !isBagged(s));
  const cur = currency ?? mainCurrency(done);
  return { currency: cur, list: done.filter((s) => s.currency === cur) };
}

/** What a tournament cost and returned in this view. */
function money(s: Session, view: StatsView) {
  return view === 'mine' ? { inv: ownBuyIns(s), net: profit(s) } : { inv: cost(s), net: gross(s) };
}

/** Bounties are part of the prize; a cash is a prize beyond them. */
const bountiesOf = (s: Session) => Math.min(Math.max(0, s.tourney?.bounties ?? 0), s.cashOut || 0);
const cashed = (s: Session) => (s.cashOut || 0) - bountiesOf(s) > 0;

export interface Summary {
  count: number;
  /** Entries including re-entries. */
  entries: number;
  invested: number;
  net: number;
  /** % of what was invested; null with nothing invested. */
  roi: number | null;
  /** % of tournaments cashed (bounties alone don't count). */
  itm: number | null;
  /** Average finish where it was noted, and how many had one. */
  avgFinish: number | null;
  finishes: number;
  /** Average finish as % of the field (lower is deeper), where both were noted. */
  avgFieldPct: number | null;
  /** % of tournaments re-entered at least once, and re-entries per tournament. */
  reentryRate: number | null;
  reentriesPer: number | null;
  bounties: number;
  /** Tournaments cashed, and prizes won in total (the whole action, bounties included). */
  cashes: number;
  prizes: number;
}

export function summarize(list: Session[], view: StatsView): Summary {
  let inv = 0;
  let net = 0;
  let entries = 0;
  let reentered = 0;
  let bounties = 0;
  let itm = 0;
  let prizes = 0;
  const fin: number[] = [];
  const pct: number[] = [];
  for (const s of list) {
    const m = money(s, view);
    inv += m.inv;
    net += m.net;
    const e = Math.max(1, s.entries || 1);
    entries += e;
    if (e > 1) reentered++;
    if (cashed(s)) itm++;
    prizes += s.cashOut || 0;
    // In "mine", bounties are yours only for the share you kept.
    bounties += bountiesOf(s) * (view === 'mine' ? Math.max(0, 1 - soldShare(s)) : 1);
    if (s.finish && s.finish > 0) {
      fin.push(s.finish);
      if (s.field && s.field >= s.finish) pct.push((s.finish / s.field) * 100);
    }
  }
  const n = list.length;
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  return {
    count: n,
    entries,
    invested: inv,
    net,
    roi: inv > 0 ? (net / inv) * 100 : null,
    itm: n ? (itm / n) * 100 : null,
    avgFinish: avg(fin),
    finishes: fin.length,
    avgFieldPct: avg(pct),
    reentryRate: n ? (reentered / n) * 100 : null,
    reentriesPer: n ? (entries - n) / n : null,
    bounties,
    cashes: itm,
    prizes,
  };
}

export interface Group extends Summary {
  key: string;
}

/** Results grouped by `by`, in the order of `order` when given (else most played first). */
export function groupBy(list: Session[], view: StatsView, by: (s: Session) => string, order?: string[]): Group[] {
  const m = new Map<string, Session[]>();
  for (const s of list) {
    const k = by(s);
    m.set(k, [...(m.get(k) ?? []), s]);
  }
  const out = [...m.entries()].map(([key, l]) => ({ key, ...summarize(l, view) }));
  return order ? out.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)) : out.sort((a, b) => b.count - a.count || b.net - a.net);
}

/** The trip a tournament was played on (festival), or '' outside any trip. */
export function tripOf(s: Session, trips: Trip[]): Trip | undefined {
  return trips.find((tr) => inRange(s.startedAt, { from: tr.from, to: tr.to }));
}

export interface Score {
  id: string;
  name: string;
  at: number;
  prize: number;
  buyIn: number;
  finish?: number;
  field?: number;
  /** Prize over what it cost (entries included), "12x". */
  multiple: number;
}

/** Biggest prizes, best first. */
export function biggestScores(list: Session[], n = 3): Score[] {
  return list
    .filter((s) => (s.cashOut || 0) > 0)
    .sort((a, b) => b.cashOut - a.cashOut)
    .slice(0, n)
    .map((s) => ({ id: s.id, name: s.name, at: s.startedAt, prize: s.cashOut, buyIn: s.buyIn, finish: s.finish, field: s.field, multiple: cost(s) > 0 ? s.cashOut / cost(s) : 0 }));
}
