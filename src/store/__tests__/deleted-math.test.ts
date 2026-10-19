/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseBackup } from '../backup';
import { sepId } from '../bankroll-math';
import { alive, bankrollMark, cleanDeleted, entryId, joinDeleted, reclaimDeleted, revive } from '../deleted-math';

test('deletes: the later time of each wins, and only what was not edited after goes', () => {
  const d = joinDeleted({ 'sessions:a': 10, 'hands:x': 5 }, { 'sessions:a': 30 });
  assert.deepEqual(d, { 'sessions:a': 30, 'hands:x': 5 });
  const list = [{ id: 'a', updatedAt: 20 }, { id: 'b', updatedAt: 1 }];
  assert.deepEqual(alive(list, 'sessions', d).map((x) => x.id), ['b']);
  assert.deepEqual(alive([{ id: 'a', updatedAt: 40 }], 'sessions', d).map((x) => x.id), ['a']);
  // Another list's delete doesn't touch an item with the same id.
  assert.equal(alive(list, 'players', d), list);
  // An item with no edit time (older data) counts as before the delete.
  assert.deepEqual(alive([{ id: 'x' }], 'hands', d), []);
});

test('deletes from a file: only well-formed keys with a real time', () => {
  assert.deepEqual(cleanDeleted({ 'sessions:a': 3, 'quarantine:x': 4, 'hands:b': -1, 'hands:c': 'x', 'trips:': 2, 'hands:\nz': 1 }), { 'sessions:a': 3 });
  assert.deepEqual(cleanDeleted([1, 2]), {});
  // A time far in the future would beat every later edit: left out.
  assert.deepEqual(cleanDeleted({ 'sessions:a': 1000 + 86_400_000, 'sessions:b': 1000 + 86_400_001 }, 1000), { 'sessions:a': 1000 + 86_400_000 });
  const b = parseBackup(JSON.stringify({ app: 'sweatbook', v: 1, exportedAt: 1, hands: [], sessions: [], players: [], deleted: { 'sessions:a': 3, bad: 1 } }));
  assert.deepEqual(b.deleted, { 'sessions:a': 3 });
  // A copy made before deletes were kept reads as none.
  assert.deepEqual(parseBackup(JSON.stringify({ app: 'sweatbook', v: 1, exportedAt: 1, hands: [], sessions: [], players: [] })).deleted, {});
});

test('deletes: the newest 5000 are kept', () => {
  const many = Object.fromEntries(Array.from({ length: 5100 }, (_, i) => [`hands:h${i}`, i + 1]));
  const d = cleanDeleted(many);
  assert.equal(Object.keys(d).length, 5000);
  assert.equal(d['hands:h0'], undefined);
  assert.equal(d['hands:h5099'], 5100);
});

test('a restore brings back what was deleted here, newer than the other phone\'s delete (QA)', () => {
  // B deleted Bone at 50; A deleted it at 60 too. B restores a file with Bone (edited at 10).
  const { backup, revived } = revive({ players: [{ id: 'bone', updatedAt: 10 }, { id: 'x', updatedAt: 5 }] }, { 'players:bone': 50 }, 100);
  assert.deepEqual(revived, ['players:bone']);
  assert.deepEqual(backup.players, [{ id: 'bone', updatedAt: 100 }, { id: 'x', updatedAt: 5 }]);
  // Joined with A's delete, it stays.
  assert.equal(alive(backup.players!, 'players', { 'players:bone': 60 }).length, 2);
  // Nothing deleted here: the same lists.
  const same = { players: [{ id: 'x', updatedAt: 5 }] };
  assert.equal(revive(same, {}, 100).backup.players, same.players);
});

test('a bankroll mark has its currency: it drops that bankroll under either name, never the same id in another currency', () => {
  const X = 'br_auto_10';
  const eur = { id: X, currency: '€', updatedAt: 1 };
  const usd = { id: X, currency: '$', updatedAt: 1 };
  const usdCopy = { id: sepId(X, '$'), currency: '$', updatedAt: 1 };
  const d = { ['bankrolls:' + bankrollMark(X, '$')]: 5 };
  assert.deepEqual(alive([eur], 'bankrolls', d), [eur]);
  assert.deepEqual(alive([usd, usdCopy], 'bankrolls', d), []);
  // The separated copy's own mark drops the bankroll it was made from, in its currency.
  assert.deepEqual(alive([eur, usd], 'bankrolls', { ['bankrolls:' + bankrollMark(sepId(X, '€'), '€')]: 5 }), [usd]);
  // An older mark with no currency still matches the id; a restore revives what it matched.
  assert.deepEqual(alive([eur], 'bankrolls', { ['bankrolls:' + X]: 5 }), []);
  assert.deepEqual(revive({ bankrolls: [usdCopy] }, d, 9).revived, ['bankrolls:' + bankrollMark(X, '$')]);
});

test('an entry I deleted while its send was unanswered, handed back by the server: off the list and on its way out', () => {
  const s = {
    id: 'S1',
    side: 'a',
    removing: ['old'],
    entries: [
      { id: 'e1', cid: 'c1', side: 'a' }, // mine, deleted here while pending: the send had landed
      { id: 'e2', cid: 'c1', side: 'b' }, // the other player's, same cid: theirs, never touched
      { id: 'e3', cid: 'c3', side: 'a' }, // mine, not deleted
      { id: 'local', cid: 'c4', side: 'a', pending: true }, // still mine to send: liveSwaps' job
    ],
  };
  const d = { ['swapEntries:' + entryId('S1', 'a', 'c1')]: 5, ['swapEntries:' + entryId('S1', 'a', 'c4')]: 5 };
  const out = reclaimDeleted(s, d, (e) => e.side === 'a', (e) => e.side);
  assert.deepEqual(out.entries.map((e) => e.id), ['e2', 'e3', 'local']);
  assert.deepEqual(out.removing, ['old', 'e1']);
  // Nothing deleted: the same object. Twice: e1 is not queued twice.
  assert.equal(reclaimDeleted(s, {}, () => true, (e) => e.side), s);
  assert.deepEqual(reclaimDeleted({ ...s, removing: ['e1'] }, d, (e) => e.side === 'a', (e) => e.side).removing, ['e1']);
  // A group: by seat.
  const g: { id: string; entries: { id: string; cid: string; seat: number }[]; removing?: string[] } = { id: 'G1', entries: [{ id: 'g1', cid: 'c1', seat: 2 }, { id: 'g2', cid: 'c1', seat: 0 }] };
  const out2 = reclaimDeleted(g, { ['swapEntries:' + entryId('G1', 2, 'c1')]: 5 }, (e) => e.seat === 2, (e) => e.seat);
  assert.deepEqual(out2.entries.map((e) => e.id), ['g2']);
  assert.deepEqual(out2.removing, ['g1']);
});
