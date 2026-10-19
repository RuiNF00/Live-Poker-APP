/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mergeById } from '../backup';
import { autoBankrollId, balanceOf, bankrollOf, emptyDuplicates, foldSeparated, refold, separateBankrolls, sessionsIn } from '../bankroll-math';
import { homeTotals } from '../fx-math';
import { totals } from '../session-math';
import type { Bankroll, Session, Transfer } from '../types';

type Phone = { bankrolls: Bankroll[]; sessions: Session[]; transfers: Transfer[] };
const ID = autoBankrollId('€');
const br = (currency: string, over: Partial<Bankroll> = {}): Bankroll => ({ id: ID, name: 'Principal', currency, createdAt: 1, ...over });
const ses = (id: string, currency: string, cashOut: number, over: Partial<Session> = {}): Session => ({
  id, kind: 'mtt', name: 'T', venue: 'V', currency, startedAt: Date.UTC(2026, 9, 1), endedAt: Date.UTC(2026, 9, 1, 5), breaks: [],
  buyIn: 100, entries: 1, addOn: 0, cashOut, sb: 1, bb: 2, ante: 0, anteType: 'none', tableSize: 9, stack: 0, stackLog: [], roster: [], notes: '', bankrollId: ID, ...over,
});

/** The restore path in store.tsx, without the UI: separate, merge, fold, drop empty copies. */
function copy(from: Phone, to: Phone, keep?: string): Phone {
  const inc = separateBankrolls(to.bankrolls, { bankrolls: from.bankrolls, sessions: from.sessions, transfers: from.transfers });
  const merged = mergeById(to.bankrolls, inc.bankrolls ?? []).list;
  const f = foldSeparated(merged);
  const sessions = refold(mergeById(to.sessions, inc.sessions).list, f.to);
  const transfers = refold(mergeById(to.transfers, inc.transfers ?? []).list, f.to);
  const extra = emptyDuplicates(f.bankrolls, sessions, transfers, keep);
  return { bankrolls: f.bankrolls.filter((b) => !extra.includes(b.id)), sessions, transfers };
}

test('two phones, the same bankroll id in € and in $: copies converge and nothing is counted twice or across currencies', () => {
  // Phone A: € under the id; phone B: an older onboarding moved it to $ and kept the id.
  let A: Phone = { bankrolls: [br('€')], sessions: [ses('a1', '€', 300), ses('a2', '€', 0)], transfers: [{ id: 'ta', bankrollId: ID, kind: 'deposit', amount: 1000, at: 1, note: '' } as Transfer] };
  let B: Phone = { bankrolls: [br('$')], sessions: [ses('b1', '$', 500)], transfers: [{ id: 'tb', bankrollId: ID, kind: 'deposit', amount: 2000, at: 1, note: '' } as Transfer] };
  for (let i = 0; i < 4; i++) {
    B = copy(A, B);
    A = copy(B, A);
  }
  for (const [name, P] of [['A', A], ['B', B]] as const) {
    assert.equal(P.bankrolls.length, 2, `${name}: ${P.bankrolls.map((b) => b.id + ' ' + b.currency).join(', ')}`);
    assert.equal(P.sessions.length, 3, name);
    assert.equal(P.transfers.length, 2, name);
    // Every session and transfer sits in a bankroll of its own currency.
    for (const s of P.sessions) assert.equal(bankrollOf(s, P.bankrolls)?.currency, s.currency, `${name} ${s.id}`);
    for (const x of P.transfers) assert.equal(P.bankrolls.find((b) => b.id === x.bankrollId)?.currency, x.id === 'ta' ? '€' : '$', `${name} ${x.id}`);
    const eur = P.bankrolls.find((b) => b.currency === '€')!;
    const usd = P.bankrolls.find((b) => b.currency === '$')!;
    // Totals per bankroll, the ROI and the balances.
    const inEur = sessionsIn({ bankrollId: eur.id }, P.sessions, P.bankrolls);
    const inUsd = sessionsIn({ bankrollId: usd.id }, P.sessions, P.bankrolls);
    assert.deepEqual(inEur.map((s) => s.id).sort(), ['a1', 'a2'], name);
    assert.deepEqual(inUsd.map((s) => s.id), ['b1'], name);
    assert.equal(totals(inEur).profit, 100, name);
    assert.equal(totals(inEur).roi, 50, name);
    assert.equal(balanceOf({ bankrollId: eur.id }, P.sessions, P.transfers, P.bankrolls).balance, 1100, name);
    assert.equal(balanceOf({ bankrollId: usd.id }, P.sessions, P.transfers, P.bankrolls).balance, 2400, name);
    // Multi-currency card: $ at 1.25 per €.
    const h = homeTotals(P, '€', { '2026-10-01': { USD: 1.25 } }, {}, Date.UTC(2026, 9, 2));
    assert.equal(h.profit, 100 + 400 / 1.25, name);
  }
});

test('an empty duplicate goes; one with a session or a rule stays', () => {
  const s = [ses('x', '€', 0, { bankrollId: ID + '~x' })];
  const list = [br('€'), br('€', { id: ID + '_2', createdAt: 2 }), br('€', { id: ID + '_3', createdAt: 3, rules: { cashBuyIns: 30, mttBuyIns: 100, stopLoss: 0, stopLossPer: 'session', target: 0 } as Bankroll['rules'] })];
  assert.deepEqual(emptyDuplicates(list, s, []), []);
  assert.deepEqual(emptyDuplicates(list, [], []), [ID + "_2"]);
  // The selected one stays even when it is not the currency's own.
  assert.deepEqual(emptyDuplicates(list.slice(0, 2), [], [], ID + '_2'), [ID]);
});
