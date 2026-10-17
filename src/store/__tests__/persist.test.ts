/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Hand } from '@/poker/types';

import { createWriter, diffCollection, loadCollection } from '../persist';
import { ANDROID_ROW_LIMIT, FakeStorage, bigHistory } from './fake-storage';

const SPEC = { index: 'rl.hands.v2', prefix: 'rl.hand.v2.', legacy: 'rl.hands.v1' };
const android = () => new FakeStorage({ rowLimit: ANDROID_ROW_LIMIT, dbLimit: 6 * 1024 * 1024 });

test('v1 layout: 2,500 hands is one value Android cannot read back', async () => {
  const kv = android();
  const hands = bigHistory(2500);
  await kv.setItem(SPEC.legacy, JSON.stringify(hands));
  await assert.rejects(kv.getItem(SPEC.legacy), /CursorWindow/);
  // The loader must not pretend it's empty-and-fine, and must not delete it.
  const r = await loadCollection<Hand>(kv, SPEC);
  assert.equal(r.items.length, 0);
  assert.ok(r.problems > 0);
  assert.ok(kv.data.has(SPEC.legacy));
});

test('v2 layout: 2,500 hands save and load on the same Android limits', async () => {
  const kv = android();
  const hands = bigHistory(2500);
  const w = createWriter<Hand>(kv, SPEC, [], () => assert.fail('write failed'));
  w.schedule(hands);
  await w.flush();
  for (const v of kv.data.values()) assert.ok(v.length < 64 * 1024);
  const r = await loadCollection<Hand>(kv, SPEC);
  assert.equal(r.problems, 0);
  assert.deepEqual(r.items.map((h) => h.id), hands.map((h) => h.id));
  assert.equal(r.persisted, r.items);
});

test('migrates v1 to per-hand keys, keeps order, then removes v1', async () => {
  const kv = new FakeStorage();
  const hands = bigHistory(300);
  await kv.setItem(SPEC.legacy, JSON.stringify(hands));
  const r = await loadCollection<Hand>(kv, SPEC);
  assert.deepEqual(r.items.map((h) => h.id), hands.map((h) => h.id));
  assert.ok(!kv.data.has(SPEC.legacy));
  assert.ok(kv.data.has(SPEC.prefix + hands[0].id));
  const again = await loadCollection<Hand>(kv, SPEC);
  assert.deepEqual(again.items, r.items);
});

test('a failed migration keeps v1 and leaves the writer to rewrite everything', async () => {
  const kv = new FakeStorage();
  const hands = bigHistory(20);
  await kv.setItem(SPEC.legacy, JSON.stringify(hands));
  kv.failWrites = true;
  const r = await loadCollection<Hand>(kv, SPEC);
  assert.equal(r.items.length, 20);
  assert.equal(r.persisted.length, 0);
  assert.ok(kv.data.has(SPEC.legacy));
});

test('a corrupt v1 value is reported and left alone, never overwritten', async () => {
  const kv = new FakeStorage();
  await kv.setItem(SPEC.legacy, '[{"id":"h1",');
  const r = await loadCollection<Hand>(kv, SPEC);
  assert.equal(r.items.length, 0);
  assert.ok(r.problems > 0);
  assert.equal(kv.data.get(SPEC.legacy), '[{"id":"h1",');
});

test('a corrupt hand is skipped, the rest load; a broken index is rebuilt from keys', async () => {
  const kv = new FakeStorage();
  const hands = bigHistory(5);
  const w = createWriter<Hand>(kv, SPEC, [], () => {});
  w.schedule(hands);
  await w.flush();
  kv.data.set(SPEC.prefix + hands[2].id, '{oops');
  let r = await loadCollection<Hand>(kv, SPEC);
  assert.equal(r.items.length, 4);
  assert.equal(r.problems, 1);
  assert.ok(kv.data.has(SPEC.prefix + hands[2].id), 'unreadable item stays on disk');

  kv.data.set(SPEC.index, 'garbage');
  r = await loadCollection<Hand>(kv, SPEC);
  assert.equal(r.items.length, 4);
  assert.deepEqual(r.items.map((h) => h.id), hands.filter((_, i) => i !== 2).map((h) => h.id), 'newest first');
});

test('saving one hand writes one hand (plus the id list when it is new)', () => {
  const hands = bigHistory(2000);
  const edited = hands.map((h, i) => (i === 10 ? { ...h, notes: 'novo' } : h));
  const d = diffCollection(SPEC, hands, edited);
  assert.deepEqual(d.set.map(([k]) => k), [SPEC.prefix + hands[10].id]);
  assert.deepEqual(d.remove, []);

  const added = [{ ...hands[0], id: 'h_new' }, ...hands];
  const d2 = diffCollection(SPEC, hands, added);
  assert.deepEqual(d2.set.map(([k]) => k), [SPEC.prefix + 'h_new', SPEC.index]);

  const removed = hands.slice(1);
  const d3 = diffCollection(SPEC, hands, removed);
  assert.deepEqual(d3.set.map(([k]) => k), [SPEC.index]);
  assert.deepEqual(d3.remove, [SPEC.prefix + hands[0].id]);
});

test('bursts of edits become one write; a failed write is retried and reported once', async () => {
  const kv = new FakeStorage();
  let errors = 0;
  const w = createWriter<Hand>(kv, SPEC, [], () => errors++, 10);
  const hands = bigHistory(3);
  w.schedule(hands.slice(2));
  w.schedule(hands.slice(1));
  w.schedule(hands);
  await w.flush();
  assert.equal(kv.writes, 1);

  kv.failWrites = true;
  const more = [{ ...hands[0], id: 'h_a' }, ...hands];
  w.schedule(more);
  await w.flush();
  w.schedule([{ ...hands[0], id: 'h_b' }, ...more]);
  await w.flush();
  assert.equal(errors, 1);

  kv.failWrites = false;
  await w.flush();
  const r = await loadCollection<Hand>(kv, SPEC);
  assert.deepEqual(r.items.map((h) => h.id).slice(0, 2), ['h_b', 'h_a']);
});

test('hand counts per player match the per-player filter they replace', async () => {
  const { handCounts } = await import('../queries');
  const hands = bigHistory(400);
  const players = ['Boné azul', 'reg alemão ', 'Miguel', 'Ninguém'].map((name, i) => ({ id: 'p' + i, name, look: '', tags: [], notes: '', createdAt: 0, updatedAt: 0 }));
  hands[0] = { ...hands[0], players: hands[0].players.map((p, j) => (j === 4 ? { ...p, playerId: 'p3' } : p)) };
  const slow = (p: (typeof players)[number]) => {
    const n = p.name.trim().toLowerCase();
    return hands.filter((h) => h.players.some((x, i) => i !== h.hero && (x.playerId === p.id || (n && x.name.trim().toLowerCase() === n)))).length;
  };
  const fast = handCounts(hands, players);
  for (const p of players) assert.equal(fast.get(p.id) ?? 0, slow(p), p.name);
});
