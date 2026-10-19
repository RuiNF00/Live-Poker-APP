import type { Session, Stake } from './types';

/**
 * Fewest hours of play behind any per-hour rate (money/h, BB/h): 15 minutes. Under that a
 * rate is noise blown up (a 3-minute +200 reads as +4000/h), so it shows as "—" or not at all.
 * The session still counts in every total, its money and its time.
 */
export const MIN_RATE_HOURS = 0.25;

/** Whether `hours` of play are enough to show a per-hour rate. */
export function rateShown(hours: number): boolean {
  return hours >= MIN_RATE_HOURS;
}

/** Time actually at the table: wall time minus breaks. */
export function playedMs(s: Session, now = Date.now()): number {
  const end = s.endedAt ?? now;
  const breaks = (s.breaks ?? []).reduce((a, b) => a + Math.max(0, (b.end ?? end) - b.start), 0);
  return Math.max(0, end - s.startedAt - breaks);
}

export function isPaused(s: Session): boolean {
  const last = s.breaks?.[s.breaks.length - 1];
  return !!last && last.end === undefined;
}

export function cost(s: Session): number {
  return s.buyIn * Math.max(1, s.entries) + (s.addOn || 0);
}

/** Every piece sold of this session; an older session's `staking` reads as one unnamed stake. */
export function stakesOf(s: Session): Stake[] {
  if (s.stakes) return s.stakes.filter((x) => x.share > 0);
  return s.staking?.sold ? [{ share: s.staking.sold, markup: s.staking.markup || 1 }] : [];
}

/** The `staking` summary kept next to `stakes`: total sold and its average markup. */
export function stakingSummary(stakes: Stake[]): Session['staking'] {
  const sold = stakes.reduce((a, x) => a + x.share, 0);
  if (!sold) return undefined;
  const markup = stakes.reduce((a, x) => a + x.share * (x.markup || 1), 0) / sold;
  return { sold: Math.round(sold * 100) / 100, markup: Math.round(markup * 1000) / 1000 };
}

/** Share sold to backers, 0–1. */
/** To the cent, per backer: the same rounding as the backer's own ledger (staking.ts). */
const c2 = (n: number) => Math.round(n * 100) / 100;

export function soldShare(s: Session): number {
  const sold = stakesOf(s).reduce((a, x) => a + x.share, 0);
  return Math.min(1, Math.max(0, sold / 100));
}

/** One stake's fraction of the whole action, 0–1 (scaled down if more than 100% was sold). */
export function pieceOf(s: Session, x: Stake): number {
  const sold = stakesOf(s).reduce((a, y) => a + y.share, 0);
  return sold > 100 ? x.share / sold : x.share / 100;
}

/** Result of the whole action, before staking and expenses. */
export function gross(s: Session): number {
  return (s.cashOut || 0) - cost(s);
}

/** What the backers paid you for their share (markup included). */
export function stakeIn(s: Session): number {
  return c2(stakesOf(s).reduce((a, x) => a + c2(pieceOf(s, x) * cost(s) * (x.markup || 1)), 0));
}

/** What you owe the backers from the prize. */
export function owedToBackers(s: Session): number {
  return c2(stakesOf(s).reduce((a, x) => a + c2(pieceOf(s, x) * (s.cashOut || 0)), 0));
}

/** Your own money in play. */
export function ownCost(s: Session): number {
  return cost(s) - stakeIn(s) + (s.expenses || 0) + (s.tips || 0);
}

/**
 * Your share of the buy-ins (re-entries and add-ons included): what ROI divides by. Tips and
 * expenses are already out of the result, and markup is part of it, so neither changes this.
 */
export function ownBuyIns(s: Session): number {
  return cost(s) * (1 - soldShare(s));
}

/**
 * Your result: your share of the prize, plus what backers paid, minus buy-ins and expenses,
 * plus your cut of a makeup package credited to this session (kept in sync by the store).
 */
export function profit(s: Session): number {
  return (s.cashOut || 0) - owedToBackers(s) - ownCost(s) + (s.makeupCut ?? s.fileCut ?? 0) + (s.swapNet || 0);
}

/** Per-session makeup cuts, by session id. Missing ids are 0. */
export type Cuts = Map<string, number>;
/**
 * Money in different currencies never adds up: every total below is for one
 * currency. Lists that mix them are split here first.
 */
export function byCurrency<T extends { currency: string }>(list: T[]): { currency: string; items: T[] }[] {
  const m = new Map<string, T[]>();
  for (const x of list) {
    const k = x.currency || '';
    const l = m.get(k);
    if (l) l.push(x);
    else m.set(k, [x]);
  }
  return [...m.entries()].map(([currency, items]) => ({ currency, items })).sort((a, b) => b.items.length - a.items.length);
}

/** The currency most of the list is in (`fallback` when empty). */
export function mainCurrency(list: { currency: string }[], fallback = '€'): string {
  return byCurrency(list)[0]?.currency ?? fallback;
}

function inCurrency(list: Session[], currency: string | undefined): Session[] {
  return currency === undefined ? list : list.filter((s) => s.currency === currency);
}

export interface Breakdown {
  key: string;
  sessions: number;
  profit: number;
  hours: number;
  hourly: number;
  /** Tournaments in the group and their ROI on your own money (null without tournaments). */
  mtts: number;
  roi: number | null;
}

/** Results grouped by venue, game or any key (blank keys skipped), best first, in one currency. */
export function breakdown(list: Session[], by: 'venue' | 'name' | ((s: Session) => string), currency = mainCurrency(list)): Breakdown[] {
  const m = new Map<string, Breakdown & { mttInv: number; mttProfit: number; timedProfit: number }>();
  for (const s of inCurrency(list, currency)) {
    if (!s.endedAt) continue;
    const key = (typeof by === 'function' ? by(s) : s[by] || '').trim();
    if (!key) continue;
    const b = m.get(key.toLowerCase()) ?? { key, sessions: 0, profit: 0, hours: 0, hourly: 0, mtts: 0, roi: null, mttInv: 0, mttProfit: 0, timedProfit: 0 };
    const p = profit(s);
    b.sessions++;
    b.profit += p;
    b.hours += playedMs(s) / 3600000;
    if (playedMs(s) > 0) b.timedProfit += p;
    if (s.kind === 'mtt') {
      b.mtts++;
      b.mttInv += ownBuyIns(s);
      b.mttProfit += p;
    }
    m.set(key.toLowerCase(), b);
  }
  return [...m.values()]
    .map(({ mttInv, mttProfit, timedProfit, ...b }) => ({ ...b, hourly: b.hours > 0 ? timedProfit / b.hours : 0, roi: mttInv > 0 ? (mttProfit / mttInv) * 100 : null }))
    .sort((a, b) => b.profit - a.profit);
}

/**
 * The profit of the sessions with time played: the only ones an hourly rate can be over. Imported
 * sessions with no hours count in the profit, never in €/h (Pesquisa: queixas-apps-poker.md).
 */
export function timedProfit(list: Session[]): number {
  return list.reduce((a, s) => a + (playedMs(s) > 0 ? profit(s) : 0), 0);
}

export interface Totals {
  /** What every amount below is in. */
  currency: string;
  /** Finished sessions in other currencies, left out of these totals. */
  otherCurrencies: string[];
  sessions: number;
  profit: number;
  /** Your share of the buy-ins: what ROI divides by. */
  invested: number;
  hours: number;
  hourly: number;
  roi: number | null;
  itm: number | null;
  best: number;
  worst: number;
  /** Dealer tips, already counted in profit. */
  tips: number;
  /** Over the sessions where hands were counted; null without any. */
  handsPerHour: number | null;
}

/** Totals of the finished sessions in `currency` (default: the one most of them use). */
export function totals(list: Session[], currency?: string): Totals {
  const ended = list.filter((s) => s.endedAt);
  const cur = currency ?? mainCurrency(ended, mainCurrency(list));
  const done = inCurrency(ended, cur);
  const p = done.reduce((a, s) => a + profit(s), 0);
  const inv = done.reduce((a, s) => a + ownBuyIns(s), 0);
  const hours = done.reduce((a, s) => a + playedMs(s), 0) / 3600000;
  const mtts = done.filter((s) => s.kind === 'mtt');
  const mttInv = mtts.reduce((a, s) => a + ownBuyIns(s), 0);
  const mttProfit = mtts.reduce((a, s) => a + profit(s), 0);
  const profits = done.map(profit);
  const counted = done.filter((s) => (s.handsDealt ?? 0) > 0);
  const countedHours = counted.reduce((a, s) => a + playedMs(s), 0) / 3600000;
  return {
    currency: cur,
    otherCurrencies: byCurrency(ended).map((g) => g.currency).filter((c) => c !== cur),
    sessions: done.length,
    profit: p,
    invested: inv,
    hours,
    hourly: hours > 0 ? timedProfit(done) / hours : 0,
    roi: mttInv > 0 ? (mttProfit / mttInv) * 100 : null,
    itm: mtts.length ? (mtts.filter((s) => s.cashOut > 0).length / mtts.length) * 100 : null,
    best: profits.length ? Math.max(...profits) : 0,
    worst: profits.length ? Math.min(...profits) : 0,
    tips: done.reduce((a, s) => a + (s.tips || 0), 0),
    handsPerHour: countedHours > 0 ? counted.reduce((a, s) => a + (s.handsDealt ?? 0), 0) / countedHours : null,
  };
}

/** Cumulative profit points in one currency, oldest first. */
export function curve(list: Session[], currency?: string): { t: number; v: number }[] {
  const ended = list.filter((s) => s.endedAt);
  const done = inCurrency(ended, currency ?? mainCurrency(ended)).sort((a, b) => a.endedAt! - b.endedAt!);
  let acc = 0;
  return [{ t: done[0]?.startedAt ?? Date.now(), v: 0 }, ...done.map((s) => ({ t: s.endedAt!, v: (acc += profit(s)) }))];
}

/** `n` calendar days after `ts` (before, if negative) at the same clock time: across a DST change a day is 23 or 25 hours. */
export function addDays(ts: number, n: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

/** `min` minutes on the clock of `day`'s local calendar day (20:00 is 20:00 even on a 23- or 25-hour day). */
export function atClock(day: number, min: number): number {
  const d = new Date(day);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(min / 60), min % 60).getTime();
}

/**
 * dd/mm or dd/mm/yyyy (also with - or .), not in the future unless `future` (a trip being planned).
 * With `future`, a day typed without a year that has already gone by is next year's. With 'near'
 * (a trip, past or planned), a day without a year is the one closest to today.
 */
export function parseDay(v: string, now = Date.now(), future: boolean | 'near' = false): number | null {
  const m = v.trim().match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/);
  if (!m) return null;
  const [dd, mm] = [Number(m[1]), Number(m[2])];
  let yy = m[3] ? Number(m[3]) : new Date(now).getFullYear();
  if (yy < 100) yy += 2000;
  const d = new Date(yy, mm - 1, dd);
  if (d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  if (future === 'near') {
    if (!m[3]) {
      const best = [yy - 1, yy + 1].map((y) => new Date(y, mm - 1, dd)).reduce((a, b) => (Math.abs(b.getTime() - now) < Math.abs(a.getTime() - now) ? b : a), d);
      return best.getMonth() === mm - 1 ? best.getTime() : d.getTime();
    }
    return d.getTime();
  }
  if (future) {
    if (!m[3] && d.getTime() < now - 86_400_000) d.setFullYear(yy + 1);
    return d.getTime();
  }
  if (!m[3] && d.getTime() > now) d.setFullYear(yy - 1);
  return d.getTime() > now ? null : d.getTime();
}

/** '20:30', '20h30', '2030' or '20' → minutes after midnight; null if it isn't a time. */
export function parseClock(v: string): number | null {
  const m = v.trim().match(/^(\d{1,2})(?:[:h.]?(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** '4h30', '4:30' → 270; '4,5' or '4.5' → 270; '4' → 240. Null outside 15 min–48 h. */
export function parseDuration(v: string): number | null {
  const x = v.trim().toLowerCase();
  let m = x.match(/^(\d{1,2})\s*[h:]\s*(\d{1,2})?$/);
  let mins: number | null = null;
  if (m) mins = Number(m[1]) * 60 + Number(m[2] ?? 0);
  else if ((m = x.match(/^(\d{1,2})(?:[.,](\d))?$/))) mins = Math.round((Number(m[1]) + Number(m[2] ?? 0) / 10) * 60);
  return mins !== null && mins >= 15 && mins <= 48 * 60 ? mins : null;
}

/**
 * Picking a game or tournament played before: what it cost and its blinds
 * the last time (`sessions` newest first). Money only carries over in the
 * same currency; a venue already typed stays.
 */
export function lastTimeAt(name: string, s: Session, sessions: Session[]): Partial<Session> {
  const p = sessions.find((x) => x.name === name && x.kind === s.kind);
  if (!p) return { name };
  const same = p.currency === s.currency;
  return {
    name,
    venue: s.venue || p.venue,
    sb: p.sb,
    bb: p.bb,
    ante: p.ante,
    anteType: p.anteType,
    ...(same ? { buyIn: p.buyIn } : {}),
    // Tournament: the starting stack; cash: the stack is the buy-in.
    ...(s.kind === 'mtt' ? { stack: p.stackLog[0]?.stack ?? p.stack } : same ? { stack: p.buyIn } : {}),
    // The level clock and the blind structure, so nobody cycles Off→15→20→30 again. The field
    // and the payouts belong to that day's event and stay behind.
    ...(p.levelMinutes ? { levelMinutes: p.levelMinutes } : {}),
    ...(s.kind === 'mtt' && p.tourney?.structure?.length
      ? { tourney: { structure: p.tourney.structure, structureName: p.tourney.structureName, startStack: p.tourney.startStack } }
      : {}),
  };
}

/**
 * A new past session starts as the last one played in that currency (of `kind`
 * when given): its kind, game, venue, stakes and buy-in, so a regular night is
 * the result and one tap. Empty when nothing was played there yet.
 */
export function lastPlayed(currency: string, sessions: Session[], kind?: Session['kind']): Partial<Session> {
  const p = sessions.filter((x) => x.endedAt && x.currency === currency && (!kind || x.kind === kind)).sort((a, b) => b.startedAt - a.startedAt)[0];
  if (!p) return {};
  return {
    kind: p.kind,
    name: p.name,
    venue: p.venue,
    format: p.format,
    sb: p.sb,
    bb: p.bb,
    ante: p.ante,
    anteType: p.anteType,
    buyIn: p.buyIn,
    stack: p.kind === 'mtt' ? (p.stackLog[0]?.stack ?? p.stack) : p.buyIn,
  };
}
