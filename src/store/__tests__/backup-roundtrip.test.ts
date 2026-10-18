/// <reference types="node" />
// The cloud copy end to end: build → seal → unseal → parse → restore onto an
// empty phone gives back every list as it was; wrong keys and other versions fail cleanly.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildStatement } from '../../lib/backing-link';
import { deriveKeys, sealAsync, unseal } from '../../lib/backup-crypto';
import type { Festival } from '../../poker/festivals';
import type { Hand } from '../../poker/types';
import { buildBackup, mergeById, parseBackup, restoredSettings, type BackupData } from '../backup';
import { mergeBackups } from '../backup-merge';
import { mergePlan, type FestivalPlan } from '../festival-plan';
import { mergeGroups, type SwapGroup } from '../swap-groups';
import { mergeSwaps, type Swap } from '../swaps';
import { DEFAULT_SETTINGS, type Backer, type BackedPlayer, type BackerPayment, type Bankroll, type PlayerNote, type Session, type Settings, type StakePackage, type Transfer, type Trip } from '../types';
import type { WeeklyTournament } from '../weekly';

const T = Date.UTC(2026, 9, 1);
const hand: Hand = {
  v: 1, id: 'h1', createdAt: T, updatedAt: T + 1, sessionId: 's1',
  game: { kind: 'cash', name: 'NLH 1/2', sb: 1, bb: 2, ante: 0, anteType: 'none', currency: '€' } as Hand['game'],
  players: [{ name: 'Hero', stack: 200, cards: ['As', 'Kd'] }, { name: 'Vilão', stack: 300 }] as Hand['players'],
  button: 1, hero: 0, actions: [{ p: 1, kind: 'raise', to: 6 }, { p: 0, kind: 'call' }],
  board: ['2c', '7h', 'Td'], tags: ['3bet'], folders: ['Rever'], review: 'pending', notes: 'nota', streetNotes: { flop: 'x' }, title: 'AK', winners: [0],
};
const session: Session = {
  id: 's1', kind: 'mtt', name: 'Main', venue: 'Estoril', currency: '€', startedAt: T, endedAt: T + 3600000, breaks: [{ start: T + 60000, end: T + 120000 }],
  buyIn: 100, entries: 2, addOn: 10, cashOut: 500, finish: 3, field: 120, expenses: 20, tips: 5, sb: 100, bb: 200, ante: 200, anteType: 'bb',
  tableSize: 9, stack: 30000, stackLog: [{ t: T, stack: 30000, level: 1 }], roster: ['A', 'B'], notes: 'bom', tags: ['focus'], day: 2, bankrollId: 'b1',
  country: 'PT', withheld: { amount: 10, form: 'other', status: 'final' }, docs: [{ id: 'd1', name: 'recibo.jpg', file: 'd1.jpg', kind: 'receipt', addedAt: T }],
  stakes: [{ backerId: 'bk1', packageId: 'pk1', share: 20, markup: 1.1 }], updatedAt: T + 5,
} as Session;
const player: PlayerNote = { id: 'p1', name: 'João', look: 'boné', tags: ['Fish'], notes: 'limpa', createdAt: T, updatedAt: T };
const bankroll: Bankroll = { id: 'b1', name: 'Principal', currency: '€', createdAt: T, updatedAt: T };
const transfer: Transfer = { id: 't1', bankrollId: 'b1', kind: 'deposit', amount: 1000, at: T, note: 'início' };
const backer: Backer & { shareKey: string } = { id: 'bk1', name: 'Miguel', note: 'IBAN', shareKey: 'k_abc123', createdAt: T };
const pkg: StakePackage = { id: 'pk1', backerId: 'bk1', name: 'Outubro', kind: 'action', share: 20, markup: 1.1, playerCut: 0, createdAt: T };
const payment: BackerPayment = { id: 'pay1', backerId: 'bk1', amount: 50, at: T, note: '', createdAt: T };
const trip: Trip = {
  id: 'tr1', name: 'Bahamas', venue: 'Nassau', currency: '$', from: T, to: T + 86400000 * 5, fx: { currency: '€', rate: 0.9 }, festivalId: 'bahamas-dez-2026',
  expenses: [{ id: 'x1', kind: 'hotel', amount: 800, currency: '$', at: T, note: 'Atlantis' }], createdAt: T,
};
const statement = buildStatement(backer, 'Rui', '€', [session], [pkg], [], T);
const backed: BackedPlayer = { id: statement.id, statement, createdAt: T, updatedAt: T };
const tok = 'ab12'.repeat(16);
const swap: Swap = {
  id: 'Ab3dE6gH9k', token: tok, side: 'a', confirmedAt: T, confirmedName: 'João',
  terms: { v: 1, scope: 'series', title: 'WSOP', venue: 'Atlantis', currency: '$', a: { name: 'Rui', pct: 5 }, b: { name: 'João', pct: 3 }, note: '', createdAt: T },
  entries: [{ id: 'e1', cid: 'c1', side: 'b', kind: 'result', amount: 100, event: 'Main', finish: 3, at: T }], links: { c1: 's1' }, createdAt: T, updatedAt: T,
};
const group: SwapGroup = {
  id: 'Gr3dE6gH9k', token: tok, seat: 0, invite: tok,
  terms: { v: 1, scope: 'series', title: 'Bahamas', venue: '', currency: '$', pct: 2, note: '', createdAt: T },
  seats: ['Rui', 'Ana', 'João'].map((name, seat) => ({ seat, name, confirmedAt: T })),
  entries: [{ id: 'g1', cid: 'gc1', seat: 1, kind: 'result', amount: 1000, event: '', finish: null, at: T }], createdAt: T, updatedAt: T,
} as SwapGroup;
const plans: Record<string, FestivalPlan> = {
  'bahamas-dez-2026': {
    picked: ['1', 'own-1'], lateReg: { '1': 240 }, sessions: { '1': 's1' }, name: 'Paradise',
    events: [{ id: 'own-1', number: 99, name: 'Satélite', game: 'NLH', buyIn: 150, guarantee: 0, start: '2026-12-03T12:00', own: true, stack: 20000, levelMinutes: 20, lateRegMin: 90 }],
  },
};
const own: Festival = {
  id: 'own-f1', name: 'Torneio da casa', venue: 'Porto', city: '', currency: '€', utcOffset: 60, tz: 'Europe/Lisbon',
  source: { label: '', checked: '2026-10-01' }, notes: [], events: [], dates: { from: '2026-11-01', to: '2026-11-03' }, own: true,
};
const weekly: WeeklyTournament = { id: 'w1', name: 'Quinta', venue: 'Casino Lisboa', currency: '€', weekday: 4, time: '21:00', buyIn: 60, stack: 30000, levelMinutes: 20 };
const settings: Settings = {
  ...DEFAULT_SETTINGS, currency: '$', nickname: 'Rui', inBB: true, defaultTableSize: 6, onboarded: true, shareNames: true, shareNotes: true, bankrollId: 'b1',
  hideAmounts: true, includeSwaps: false, mindAsk: false, haptics: false, monthRecap: false, notifyAmounts: true, notifyHoldInSession: false, icm: true, widgetResult: true,
  fxManual: { ARS: 1100 }, streakPauses: [{ from: T, to: T + 86400000 }],
};

const everything = () =>
  buildBackup(
    {
      hands: [hand], sessions: [session], players: [player], bankrolls: [bankroll], transfers: [transfer], backers: [backer], packages: [pkg], payments: [payment],
      trips: [trip], backing: [backed], swaps: [swap], swapGroups: [group], festivalPlans: plans, ownFestivals: [own], weekly: [weekly], settings,
      quarantine: [['rl.quarantine.v1.1.rl.hand.v2.zz', '{']],
    },
    T + 99,
  );

async function throughCloud(b: BackupData, secret = 'ABCDEFGHJKMNPQRS', readWith = secret): Promise<BackupData> {
  const body = await sealAsync(JSON.stringify(b), deriveKeys(secret).enc, new Uint8Array(12).fill(7), async () => {});
  return parseBackup(unseal(body, deriveKeys(readWith).enc, true));
}

test('backup → cloud → restore: every list comes back identical', async () => {
  const sent = everything();
  const back = await throughCloud(sent);
  for (const k of ['hands', 'sessions', 'players', 'bankrolls', 'transfers', 'backers', 'packages', 'payments', 'trips', 'backing', 'swaps', 'swapGroups', 'festivalPlans', 'ownFestivals', 'weekly', 'quarantine', 'exportedAt'] as const)
    assert.deepEqual(back[k], sent[k], k);
});

test('restore onto a wiped phone: every setting the backup holds comes back', async () => {
  const back = await throughCloud(everything());
  const fresh = { ...DEFAULT_SETTINGS, onboarded: true };
  assert.deepEqual(restoredSettings(fresh, back.settings, true), settings);
});

test('restore onto a phone in use keeps its choices but adds the exchange rates it lacks', () => {
  const mine: Settings = { ...DEFAULT_SETTINGS, currency: '€', fxManual: { CLP: 1000, ARS: 1200 } };
  const r = restoredSettings(mine, settings, false);
  assert.equal(r.currency, '€');
  assert.deepEqual(r.fxManual, { CLP: 1000, ARS: 1200 });
  assert.deepEqual(restoredSettings({ ...DEFAULT_SETTINGS }, { fxManual: { ARS: 1100, bad: -1 } as Record<string, number> }, false).fxManual, { ARS: 1100 });
});

test('restore: the year notice that went out on the other phone doesn\'t go out again', () => {
  const now = new Date(2027, 0, 5).getTime();
  // Sent for 2025; the 2026 one fired on 31 December on the old phone.
  const old = { yearRecapSent: 2025, yearRecapAt: new Date(2026, 11, 31, 20).getTime() };
  assert.equal(restoredSettings({ ...DEFAULT_SETTINGS }, old, true, now).yearRecapSent, 2026);
  assert.equal(restoredSettings({ ...DEFAULT_SETTINGS }, old, false, now).yearRecapSent, 2026);
  // Still waiting to go out: not counted as sent.
  assert.equal(restoredSettings({ ...DEFAULT_SETTINGS }, { yearRecapSent: 2025, yearRecapAt: now + 1 }, true, now).yearRecapSent, 2025);
  // The phone's own later mark stays.
  assert.equal(restoredSettings({ ...DEFAULT_SETTINGS, yearRecapSent: 2026 }, { yearRecapSent: 2024 }, false, now).yearRecapSent, 2026);
});

test('receipts: only the file name travels, never the picture', () => {
  const json = JSON.stringify(everything());
  assert.ok(json.includes('"file":"d1.jpg"'));
  assert.ok(!/data:image|base64|file:\/\//.test(json));
});

test('wrong key: refused before anything is read', async () => {
  await assert.rejects(throughCloud(everything(), 'ABCDEFGHJKMNPQRS', 'ZZZZZZZZZZZZZZZZ'), /forbidden/);
});

test('a copy from a newer app version is refused with its own reason, not as a broken file', () => {
  assert.throws(() => parseBackup(JSON.stringify({ ...everything(), v: 2 })), /newer/);
  assert.throws(() => parseBackup(JSON.stringify({ app: 'sweatbook', v: '1' })), /invalid/);
  // Same version, fields this app doesn't know yet: read, the rest kept as it was.
  const back = parseBackup(JSON.stringify({ ...everything(), coming: [1], hands: [{ ...hand, later: true }] }));
  assert.equal(back.hands.length, 1);
  assert.equal(back.sessions[0].cashOut, 500);
});

test('a copy from an older version: missing fields get defaults, broken items are left out', () => {
  const { tags: _t, notes: _n, board: _b, ...oldHand } = hand;
  const { stackLog: _s, roster: _r, breaks: _br, tableSize: _ts, ...oldSession } = session;
  const back = parseBackup(
    JSON.stringify({
      app: 'sweatbook', v: 1, exportedAt: 1,
      hands: [oldHand, { id: 'nope', players: [], actions: [] }, { ...hand, id: 'h2', hero: 7 }],
      sessions: [oldSession, { id: 's2', startedAt: 1, stakes: 'x' }],
      players: [{ id: 'p2', name: 'Ana' }],
      trips: [{ id: 'tr2', name: 'x', currency: '€', from: 1, to: 2 }],
    }),
  );
  assert.deepEqual(back.hands.map((h) => [h.id, h.tags, h.notes, h.board]), [['h1', [], '', []]]);
  assert.deepEqual(back.sessions.map((s) => [s.id, s.stackLog, s.roster, s.breaks, s.tableSize]), [['s1', [], [], [], 9]]);
  assert.deepEqual([back.players[0].look, back.players[0].tags], ['', []]);
  assert.deepEqual(back.trips?.[0].expenses, []);
  assert.deepEqual([back.bankrolls, back.swaps, back.weekly, back.festivalPlans], [[], [], [], {}]);
});

test('restoring the same copy twice, or onto a phone with some of it, adds nothing twice and deletes nothing', async () => {
  const back = await throughCloud(everything());
  const localOnly: PlayerNote = { ...player, id: 'p-local' };
  const once = mergeById([player, localOnly], back.players);
  assert.equal(once.added, 0);
  const twice = mergeById(once.list, back.players);
  assert.deepEqual(twice.list.map((p) => p.id), ['p1', 'p-local']);
  assert.equal(mergeById(mergeById([], back.hands).list, back.hands).list.length, 1);
  assert.equal(mergeSwaps(mergeSwaps([], back.swaps!).list, back.swaps!).list.length, 1);
  assert.equal(mergeGroups(mergeGroups([], back.swapGroups!).list, back.swapGroups!).list.length, 1);
  const p = mergePlan(mergePlan(undefined, back.festivalPlans!['bahamas-dez-2026']), back.festivalPlans!['bahamas-dez-2026']);
  assert.deepEqual(p.picked, ['1', 'own-1']);
  assert.equal(p.events?.length, 1);
  const m = mergeBackups(back, back);
  for (const k of ['hands', 'sessions', 'trips', 'weekly', 'ownFestivals'] as const) assert.equal((m[k] as unknown[]).length, 1, k);
});

test('an item that fails the launch checks goes to quarantine on restore, once, under the launch keys', async () => {
  const { SPECS, QUARANTINE: BOOT_Q } = await import('../boot');
  const { ITEM_PREFIX, QUARANTINE } = await import('../backup');
  assert.equal(QUARANTINE, BOOT_Q);
  for (const k of ['hands', 'sessions', 'players', 'trips'] as const) assert.equal(ITEM_PREFIX[k], SPECS[k].prefix);
  // Swaps live in their own stores (swaps-store.ts, swap-groups-store.ts).
  assert.equal(ITEM_PREFIX.swaps, 'rl.swap.v1.');
  assert.equal(ITEM_PREFIX.swapGroups, 'rl.swapgroup.v1.');
  const badSwap = { ...swap, id: 'Bad00001', terms: null };
  const sq = parseBackup(JSON.stringify({ app: 'sweatbook', v: 1, swaps: [swap, badSwap], swapGroups: [{ ...group, seats: 'x' }] }));
  assert.deepEqual(sq.swaps!.map((x) => x.id), [swap.id]);
  assert.deepEqual(sq.quarantine!.map(([k]) => k).sort(), [`${QUARANTINE}backup.rl.swap.v1.Bad00001`, `${QUARANTINE}backup.rl.swapgroup.v1.${group.id}`].sort());
  const bad = { ...session, id: 'sx', stakes: 'not a list' };
  const text = JSON.stringify({ app: 'sweatbook', v: 1, sessions: [session, bad], quarantine: [[`${QUARANTINE}backup.rl.session.v2.sx`, '{}']] });
  const b = parseBackup(text);
  assert.deepEqual(b.sessions.map((s) => s.id), ['s1']);
  assert.deepEqual(b.quarantine!.map(([k]) => k), [`${QUARANTINE}backup.rl.session.v2.sx`]);
  const q = parseBackup(JSON.stringify({ app: 'sweatbook', v: 1, sessions: [bad] })).quarantine!;
  assert.equal(JSON.parse(q[0][1]).stakes, 'not a list');
});

test('a receipt file name that climbs out of the documents folder is dropped, the session stays', () => {
  const docs = [
    { id: 'd1', name: 'Recibo', file: 'd1.jpg', kind: 'receipt', addedAt: T },
    { id: 'd2', name: 'x', file: '../../Library/x', kind: 'receipt', addedAt: T },
    { id: 'd3', name: 'y', file: '..', kind: 'other', addedAt: T },
  ];
  const b = parseBackup(JSON.stringify({ app: 'sweatbook', v: 1, sessions: [{ ...session, docs }] }));
  assert.deepEqual(b.sessions[0].docs!.map((d) => d.file), ['d1.jpg']);
});

test('a null record or one with no id next to good ones: the good ones still restore', () => {
  const junk = [null, { name: 'sem id' }, { id: 7 }, 'texto'];
  const b = parseBackup(JSON.stringify({ app: 'sweatbook', v: 1, hands: [...junk, hand], sessions: [...junk, session], players: [...junk], trips: [...junk] }));
  assert.deepEqual(b.hands.map((h) => h.id), ['h1']);
  assert.deepEqual(b.sessions.map((s) => s.id), ['s1']);
  assert.deepEqual(b.quarantine, []);
});
