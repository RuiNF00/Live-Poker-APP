/// <reference types="node" />
// A swap or a pending entry I deleted stays deleted: on my other phone, in the backup and after a
// restore. Entries the server already has are never touched, and the other player's accounts
// never move.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildBackup } from '../backup';
import { mergeBackups } from '../backup-merge';
import { cleanDeleted, entryId, joinDeleted, keyOf, liveSwaps, swapMarks, type Deleted } from '../deleted-math';
import type { GroupEntry, SwapGroup } from '../swap-groups';
import { mergeSwaps, swapLedger, type Swap, type SwapEntry } from '../swaps';
import { DEFAULT_SETTINGS } from '../types';

const terms = { v: 1, scope: 'series', title: 'Série', venue: '', currency: '€', a: { name: 'Ana', pct: 10 }, b: { name: 'Bruno', pct: 10 }, note: '', createdAt: 1 } as const;
const e = (side: 'a' | 'b', kind: SwapEntry['kind'], amount: number, cid: string, pending?: boolean): SwapEntry => ({ id: cid, cid, side, kind, amount, event: '', finish: null, at: 1, ...(pending ? { pending } : {}) });
const swap = (id: string, entries: SwapEntry[], over: Partial<Swap> = {}): Swap => ({ id, token: 't', side: 'a', terms, entries, confirmedAt: 1, createdAt: 1, updatedAt: 10, ...over });
const side = (x: SwapEntry) => x.side;
const backup = (swaps: Swap[], deleted: Deleted = {}, swapGroups: SwapGroup[] = []) => ({ ...buildBackup({ hands: [], sessions: [], players: [], settings: DEFAULT_SETTINGS, swaps, swapGroups }, 100), deleted });

test('a swap I deleted goes, even from a copy changed after the delete', () => {
  const d = { [keyOf('swaps', 's1')]: 50 };
  const list = [swap('s1', [], { updatedAt: 999 }), swap('s2', [])];
  assert.deepEqual(liveSwaps(list, 'swaps', d, side).map((s) => s.id), ['s2']);
  const same = [swap('s2', [])];
  assert.equal(liveSwaps(same, 'swaps', d, side), same, 'nothing deleted: the same array');
});

test('deleted on phone A, then A backs up and B joins in: the swap is gone, not «Apagado do servidor»', () => {
  const s = swap('s1', [e('b', 'result', 1000, 'r1')]);
  const a = backup([], { [keyOf('swaps', 's1')]: 50 });
  const b = backup([s]);
  assert.deepEqual(mergeBackups(a, b).swaps, []);
  assert.deepEqual(mergeBackups(b, a).swaps, []);
  // B then takes the joined copy: its own swap goes too (importSwaps runs the same filter).
  const joined = mergeBackups(a, b);
  assert.deepEqual(liveSwaps(mergeSwaps([s], joined.swaps ?? []).list, 'swaps', joined.deleted ?? {}, side), []);
});

test('a pending «Paguei» I deleted is not sent again after a restore, and the other player’s balance does not move', () => {
  const sent = e('b', 'result', 1000, 'r1');
  const deletedPay = e('a', 'payment', 100, 'p1', true);
  // The backup file was taken while the payment still waited for signal.
  const file = backup([swap('s1', [sent, deletedPay])]);
  const d: Deleted = { [keyOf('swapEntries', entryId('s1', 'a', 'p1'))]: 60 };
  const restored = liveSwaps(file.swaps ?? [], 'swaps', joinDeleted(d, file.deleted), side);
  assert.deepEqual(restored[0].entries.map((x) => x.cid), ['r1']);
  assert.equal(restored[0].entries.some((x) => x.pending), false, 'nothing left to send');
  // Bruno's side, from what the server has: he still owes 100, as before the restore.
  assert.equal(swapLedger({ ...restored[0], side: 'b' }).balance, -100);
});

test('an entry the server already has stays, even with a mark of the same key', () => {
  const d: Deleted = { [keyOf('swapEntries', entryId('s1', 'a', 'p1'))]: 60 };
  const list = [swap('s1', [e('b', 'result', 1000, 'r1'), e('a', 'payment', 100, 'p1')])];
  assert.equal(liveSwaps(list, 'swaps', d, side), list);
  // The same cid from the other side is someone else's entry: it stays too.
  const theirs = [swap('s1', [e('b', 'payment', 100, 'p1', true)])];
  assert.equal(liveSwaps(theirs, 'swaps', d, side), theirs);
});

test('groups: a group I left stays left, and a pending prize I deleted is not sent', () => {
  const ge = (seat: number, cid: string, pending?: boolean): GroupEntry => ({ id: cid, cid, seat, kind: 'result', amount: 500, event: '', finish: null, at: 1, ...(pending ? { pending } : {}) });
  const g = (id: string, entries: GroupEntry[]): SwapGroup => ({
    id, token: 't', seat: 1, entries, createdAt: 1, updatedAt: 10,
    terms: { v: 1, scope: 'series', title: 'G', venue: '', currency: '€', pct: 2, note: '', createdAt: 1 },
    seats: [0, 1, 2].map((seat) => ({ seat, name: `P${seat}`, confirmedAt: 1 })),
  });
  const d: Deleted = { [keyOf('swapGroups', 'g1')]: 50, [keyOf('swapEntries', entryId('g2', 1, 'x'))]: 50 };
  const out = liveSwaps([g('g1', []), g('g2', [ge(0, 'x'), ge(1, 'x', true), ge(1, 'y', true)])], 'swapGroups', d, (x) => x.seat);
  assert.deepEqual(out.map((x) => x.id), ['g2']);
  assert.deepEqual(out[0].entries.map((x) => `${x.seat}${x.cid}`), ['0x', '1y']);
  const m = mergeBackups(backup([], d), backup([], {}, [g('g1', [])]));
  assert.deepEqual(m.swapGroups, []);
});

test('swap marks survive a backup file and a restore (they are not brought back like the other lists)', () => {
  const d = cleanDeleted({ [keyOf('swaps', 's1')]: 5, [keyOf('swapGroups', 'g1')]: 5, [keyOf('swapEntries', entryId('s1', 'a', 'c~0'))]: 5, 'nope:x': 5 });
  assert.deepEqual(Object.keys(d).sort(), ['swapEntries:s1:ac~0', 'swapGroups:g1', 'swaps:s1']);
});

test('«Apagar tudo» keeps only the swaps’ marks', () => {
  const d: Deleted = { [keyOf('hands', 'h1')]: 1, [keyOf('sessions', 's1')]: 1, [keyOf('swaps', 's1')]: 2, [keyOf('swapGroups', 'g1')]: 2, [keyOf('swapEntries', 'x:a1')]: 2 };
  assert.deepEqual(Object.keys(swapMarks(d)).sort(), ['swapEntries:x:a1', 'swapGroups:g1', 'swaps:s1']);
});
