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

/** To the cent, or within 1 when either side is whole: some apps round. */
const sameAmount = (a: number, b: number) => {
  const d = Math.abs(Math.round(a * 100) - Math.round(b * 100));
  return d === 0 || (d <= 100 && (Number.isInteger(a) || Number.isInteger(b)));
};

const near = (a: number, b: number) => dayKey(a) === dayKey(b) || Math.abs(a - b) < THREE_HOURS;

/** Ids of incoming sessions that match an existing one, each existing session matched at most once. */
export function likelyDuplicates(incoming: Session[], existing: Session[]): Set<string> {
  const have = new Set(existing.map((s) => s.id));
  const byKind = new Map<string, Session[]>();
  for (const s of existing) {
    const k = s.kind + '|' + s.currency;
    const list = byKind.get(k);
    if (list) list.push(s);
    else byKind.set(k, [s]);
  }
  const used = new Set<string>();
  const out = new Set<string>();
  for (const s of incoming) {
    // Same id: the import merges it anyway.
    if (have.has(s.id)) continue;
    const g = gross(s);
    const pair = byKind.get(s.kind + '|' + s.currency)?.find((e) => !used.has(e.id) && near(e.startedAt, s.startedAt) && sameAmount(gross(e), g));
    if (pair) {
      used.add(pair.id);
      out.add(s.id);
    }
  }
  return out;
}

/** Deposits and withdrawals the same way: same currency, direction, amount and day. */
export function likelyDuplicateMoves(incoming: ImportedMove[], existing: Transfer[], bankrolls: Bankroll[]): Set<string> {
  const currency = new Map(bankrolls.map((b) => [b.id, b.currency]));
  const have = new Set(existing.map((x) => x.id));
  const used = new Set<string>();
  const out = new Set<string>();
  for (const m of incoming) {
    if (have.has(m.id)) continue;
    const pair = existing.find((x) => !used.has(x.id) && x.kind === m.kind && currency.get(x.bankrollId) === m.currency && dayKey(x.at) === dayKey(m.at) && Math.round(x.amount * 100) === Math.round(m.amount * 100));
    if (pair) {
      used.add(pair.id);
      out.add(m.id);
    }
  }
  return out;
}
