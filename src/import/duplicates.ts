// Sessions in an imported file that look like ones already in Sweatbook: the same
// night logged in another app, or typed by hand before switching. Importing the
// same file twice is already handled by the id; this catches what the id can't.
// Rule agreed with the Bankroll thread. Venue and name don't count, as every app
// writes them its own way; nothing existing is ever changed, only left out.

import type { ImportedMove } from './convert';
import type { Bankroll, Session, Transfer } from '../store/types';

const THREE_HOURS = 3 * 3600_000;

const dayKey = (t: number) => {
  const d = new Date(t);
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
};

/** The whole action at the table: other apps have no stakes, swaps, makeup, tips or expenses. */
const gross = (s: Session) => (s.cashOut || 0) - (s.buyIn || 0) * (s.entries || 1) - (s.addOn || 0);

/** In whole cents: 150.30 - 50.30 is 100.00000000000001 in floating point, and still a whole 100. */
const cents = (x: number) => Math.round(x * 100);
/** To the cent, or at most 0.50 apart when only one side is whole: that app rounded. Two whole amounts must be equal. */
const sameAmount = (a: number, b: number) => {
  const d = Math.abs(cents(a) - cents(b));
  return d === 0 || (d <= 50 && (cents(a) % 100 === 0) !== (cents(b) % 100 === 0));
};

const near = (a: number, b: number) => dayKey(a) === dayKey(b) || Math.abs(a - b) < THREE_HOURS;

/** Existing items grouped by kind, currency and day, each with its place in the list so the first match still wins. */
function index<T>(items: T[], key: (x: T) => string, at: (x: T) => number): Map<string, [number, T][]> {
  const m = new Map<string, [number, T][]>();
  items.forEach((x, i) => {
    const k = key(x) + '|' + dayKey(at(x));
    const list = m.get(k);
    if (list) list.push([i, x]);
    else m.set(k, [[i, x]]);
  });
  return m;
}

/** Incoming session id → the existing session it matches, each existing session matched at most once. */
export function likelyDuplicates(incoming: Session[], existing: Session[]): Map<string, Session> {
  const have = new Set(existing.map((s) => s.id));
  // Only the same day and the days 3 hours either side can hold a match: 2,000 sessions against
  // a 10,000-row file was 20 million comparisons on the review screen.
  const groups = index(existing, (s) => s.kind + '|' + s.currency, (s) => s.startedAt);
  const used = new Set<string>();
  const out = new Map<string, Session>();
  for (const s of incoming) {
    // Same id: the import merges it anyway.
    if (have.has(s.id)) continue;
    const g = gross(s);
    const k = s.kind + '|' + s.currency + '|';
    const days = new Set([dayKey(s.startedAt - THREE_HOURS), dayKey(s.startedAt), dayKey(s.startedAt + THREE_HOURS)]);
    let pair: [number, Session] | undefined;
    for (const d of days)
      for (const c of groups.get(k + d) ?? [])
        if ((!pair || c[0] < pair[0]) && !used.has(c[1].id) && near(c[1].startedAt, s.startedAt) && sameAmount(gross(c[1]), g)) {
          pair = c;
          break;
        }
    if (pair) {
      used.add(pair[1].id);
      out.set(s.id, pair[1]);
    }
  }
  return out;
}

/** Deposits and withdrawals the same way: same currency, direction, amount and day. */
export function likelyDuplicateMoves(incoming: ImportedMove[], existing: Transfer[], bankrolls: Bankroll[]): Set<string> {
  const currency = new Map(bankrolls.map((b) => [b.id, b.currency]));
  const have = new Set(existing.map((x) => x.id));
  const groups = index(existing, (x) => x.kind + '|' + currency.get(x.bankrollId), (x) => x.at);
  const used = new Set<string>();
  const out = new Set<string>();
  for (const m of incoming) {
    if (have.has(m.id)) continue;
    const pair = groups.get(m.kind + '|' + m.currency + '|' + dayKey(m.at))?.find(([, x]) => !used.has(x.id) && cents(x.amount) === cents(m.amount));
    if (pair) {
      used.add(pair[1].id);
      out.add(m.id);
    }
  }
  return out;
}
