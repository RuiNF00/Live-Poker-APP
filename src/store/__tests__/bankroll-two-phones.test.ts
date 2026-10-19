/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mergeById } from '../backup';
import { mergeBackups } from '../backup-merge';
import { autoBankrollId, balanceOf, bankrollOf, emptyDuplicates, foldSeparated, refold, separateBankrolls, sessionsIn } from '../bankroll-math';
import { homeTotals } from '../fx-math';
import { alive, bankrollMark, joinDeleted, type Deleted } from '../deleted-math';
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
  // Next to the used one (a session that falls back to it), the empty copy goes; the one with rules stays.
  assert.deepEqual(emptyDuplicates(list, s, []), [ID + '_2']);
  // With no session, the one with rules is the one that stays.
  assert.deepEqual(emptyDuplicates(list, [], []), [ID, ID + '_2']);
  // The selected one stays even when it is not the currency's own.
  assert.deepEqual(emptyDuplicates(list.slice(0, 2), [], [], ID + '_2'), [ID]);
});

type Synced = Phone & { deleted: Deleted };

/** A copy between phones with deletes: what importData does (separate, join the marks, merge, fold, drop empty copies). */
function sync(from: Synced, to: Synced, keep?: string): Synced {
  const inc = separateBankrolls(to.bankrolls, { bankrolls: from.bankrolls, sessions: from.sessions, transfers: from.transfers, deleted: from.deleted });
  const deleted = joinDeleted(to.deleted, inc.deleted);
  const merged = alive(mergeById(to.bankrolls, inc.bankrolls ?? []).list, 'bankrolls', deleted);
  const f = foldSeparated(merged);
  const sessions = refold(alive(mergeById(to.sessions, inc.sessions).list, 'sessions', deleted), f.to);
  const transfers = refold(alive(mergeById(to.transfers, inc.transfers ?? []).list, 'transfers', deleted), f.to);
  const extra = emptyDuplicates(f.bankrolls, sessions, transfers, keep);
  return { bankrolls: f.bankrolls.filter((b) => !extra.includes(b.id)), sessions, transfers, deleted };
}

/** deleteBankroll in store.tsx: its sessions and transfers move to another in its currency, and the mark has the currency. */
function remove(P: Synced, id: string, at: number): Synced {
  const gone = P.bankrolls.find((b) => b.id === id)!;
  const to = P.bankrolls.find((b) => b.id !== id && b.currency === gone.currency);
  const move = <T extends { bankrollId?: string; updatedAt?: number }>(l: T[]) => (to ? l.map((x) => (x.bankrollId === id ? { ...x, bankrollId: to.id, updatedAt: at } : x)) : l);
  return { bankrolls: P.bankrolls.filter((b) => b.id !== id), sessions: move(P.sessions), transfers: move(P.transfers), deleted: { ...P.deleted, ['bankrolls:' + bankrollMark(id, gone.currency)]: at } };
}

const bal = (P: Phone, id: string) => balanceOf({ bankrollId: id }, P.sessions, P.transfers, P.bankrolls).balance;

test('deleting the $ bankroll on one phone never deletes the € one with the same id on the other', () => {
  let A: Synced = { bankrolls: [br('€', { name: 'Main' })], sessions: [ses('a1', '€', 450)], transfers: [{ id: 'tA1', bankrollId: ID, kind: 'deposit', amount: 1000, at: 1, note: '' } as Transfer], deleted: {} };
  let B: Synced = { bankrolls: [br('$')], sessions: [ses('b1', '$', 500)], transfers: [], deleted: {} };
  B = sync(A, B);
  A = sync(B, A);
  // On B: a new "Online $", then the $ "Principal" goes (its session moves to Online $).
  B = { ...B, bankrolls: [...B.bankrolls, br('$', { id: 'b_online', name: 'Online $', createdAt: 5, updatedAt: 5 })] };
  B = remove(B, ID, 10);
  for (let i = 0; i < 4; i++) {
    B = sync(A, B);
    A = sync(B, A);
  }
  for (const [name, P] of [['A', A], ['B', B]] as const) {
    assert.deepEqual(P.bankrolls.map((b) => `${b.name}|${b.currency}`).sort(), ['Main|€', 'Online $|$'], `${name}: ${P.bankrolls.map((b) => b.id).join(', ')}`);
    const eur = P.bankrolls.find((b) => b.currency === '€')!;
    assert.equal(bal(P, eur.id), 1350, name);
    assert.equal(P.transfers.find((x) => x.id === 'tA1')?.bankrollId, eur.id, name);
    assert.equal(bal(P, 'b_online'), 400, name);
  }
});

test('deleting the separated copy on one phone deletes that bankroll on the other too, and its money follows', () => {
  let A: Synced = { bankrolls: [br('€', { name: 'Main EUR' })], sessions: [ses('a1', '€', 450)], transfers: [], deleted: {} };
  let B: Synced = { bankrolls: [br('$')], sessions: [ses('b1', '$', 500)], transfers: [], deleted: {} };
  B = sync(A, B);
  A = sync(B, A);
  const copyId = B.bankrolls.find((b) => b.currency === '€')!.id;
  assert.notEqual(copyId, ID);
  // On B: a new "Live €", then the copy of A's "Main EUR" goes (its session moves to Live €).
  B = { ...B, bankrolls: [...B.bankrolls, br('€', { id: 'b_live', name: 'Live €', createdAt: 5, updatedAt: 5 })] };
  B = remove(B, copyId, 10);
  for (let i = 0; i < 3; i++) {
    A = sync(B, A);
    B = sync(A, B);
  }
  for (const [name, P] of [['A', A], ['B', B]] as const) {
    assert.deepEqual(P.bankrolls.map((b) => `${b.name}|${b.currency}`).sort(), ['Live €|€', 'Principal|$'], `${name}: ${P.bankrolls.map((b) => b.id).join(', ')}`);
    assert.equal(bal(P, 'b_live'), 350, name);
  }
});

test('an older delete mark with no currency, for the other phone\'s bankroll, stays off this one', () => {
  const A: Synced = { bankrolls: [br('€', { name: 'Main' })], sessions: [ses('a1', '€', 450)], transfers: [], deleted: {} };
  let B: Synced = { bankrolls: [br('$'), br('$', { id: 'b_online', name: 'Online $', createdAt: 5 })], sessions: [ses('b1', '$', 500)], transfers: [], deleted: {} };
  B = sync(A, B);
  // An older build deleted B's $ bankroll with a bare mark.
  B = { ...remove(B, ID, 10), deleted: { ['bankrolls:' + ID]: 10 } };
  const after = sync(B, A);
  assert.ok(after.bankrolls.some((b) => b.id === ID && b.currency === '€'), after.bankrolls.map((b) => b.id).join(', '));
  assert.equal(bal(after, ID), 350);
});

test('phones that had multiplied empty copies get back to one bankroll per currency, and so does the server copy', () => {
  const mains = [br('€', { name: 'Main' }), br('€', { id: ID + '_2', name: 'Main', createdAt: 2 }), br('€', { id: ID + '~x', name: 'Main', createdAt: 3 })];
  const usd = (id: string, at: number) => br('$', { id, name: 'Principal', createdAt: at });
  let A: Synced = { bankrolls: [...mains, usd('br_auto_u1', 4), usd('br_auto_u2', 5)], sessions: [ses('a1', '€', 450), ses('b1', '$', 500, { bankrollId: 'br_auto_u2' })], transfers: [], deleted: {} };
  let B: Synced = { ...A, bankrolls: [...A.bankrolls, usd('br_auto_u3', 6), br('€', { id: ID + '_3', name: 'Main', createdAt: 7 })] };
  for (let i = 0; i < 3; i++) {
    B = sync(A, B);
    A = sync(B, A);
  }
  for (const [name, P] of [['A', A], ['B', B]] as const) assert.deepEqual(P.bankrolls.map((b) => b.id).sort(), [ID, 'br_auto_u2'], name);
  const backup = (P: Synced) => ({ version: 1, exportedAt: 1, hands: [], players: [], ...P }) as unknown as Parameters<typeof mergeBackups>[0];
  const up = mergeBackups(backup(A), backup({ ...B, bankrolls: [...B.bankrolls, ...mains, usd('br_auto_u1', 4)] }));
  assert.deepEqual(up.bankrolls?.map((b) => b.id).sort(), [ID, 'br_auto_u2']);
});
