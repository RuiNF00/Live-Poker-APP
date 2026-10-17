// Where imported sessions and deposits go: one bankroll per currency in the
// file, either one the player already has or a new one named after the app
// it came from. Pure, so it can be tested.

import type { Bankroll, Session, Transfer } from '@/store/types';

import type { ImportedMove } from './convert';

/** Per currency: an existing bankroll id, or 'new'. */
export type Placement = Record<string, string>;

export const NEW = 'new';

/** Same id for the same app and currency, so a second import lands in the same new bankroll. */
export function importBankrollId(source: string, currency: string): string {
  return 'br_imp_' + source + '_' + [...currency].map((c) => c.codePointAt(0)!.toString(36)).join('_');
}

/** Currencies in the file, the player's own first. */
export function currenciesOf(sessions: Session[], moves: ImportedMove[], own: string): string[] {
  const set = new Set([...sessions.map((s) => s.currency), ...moves.map((m) => m.currency)]);
  return [...set].sort((a, b) => Number(b === own) - Number(a === own) || a.localeCompare(b));
}

/** The bankroll the player is using if it fits the currency, else the first one in it, else a new one. */
export function defaultPlacement(currencies: string[], bankrolls: Bankroll[], preferred?: Bankroll): Placement {
  const p: Placement = {};
  for (const c of currencies) {
    if (preferred && preferred.currency === c && bankrolls.some((b) => b.id === preferred.id)) p[c] = preferred.id;
    else p[c] = [...bankrolls].sort((a, b) => a.createdAt - b.createdAt).find((b) => b.currency === c)?.id ?? NEW;
  }
  return p;
}

export function place(
  r: { sessions: Session[]; moves: ImportedMove[] },
  placement: Placement,
  opt: { source: string; appName: string; bankrolls: Bankroll[]; now?: number },
): { sessions: Session[]; transfers: Transfer[]; bankrolls: Bankroll[] } {
  const now = opt.now ?? Date.now();
  const made: Bankroll[] = [];
  const currencies = Object.keys(placement);
  const idFor = (c: string): string => {
    const choice = placement[c];
    if (choice && choice !== NEW && opt.bankrolls.some((b) => b.id === choice && b.currency === c)) return choice;
    const id = importBankrollId(opt.source, c);
    if (!made.some((b) => b.id === id) && !opt.bankrolls.some((b) => b.id === id))
      made.push({ id, name: currencies.length > 1 ? `${opt.appName} ${c}` : opt.appName, currency: c, createdAt: now + made.length });
    return id;
  };
  return {
    sessions: r.sessions.map((s) => ({ ...s, bankrollId: idFor(s.currency) })),
    transfers: r.moves.map((m) => ({ id: m.id, bankrollId: idFor(m.currency), kind: m.kind, amount: m.amount, at: m.at, note: m.note })),
    bankrolls: made,
  };
}
