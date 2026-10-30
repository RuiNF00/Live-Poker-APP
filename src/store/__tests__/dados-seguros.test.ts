/// <reference types="node" />
// The app killed in the middle of a write, at every point, and a phone that fills up half-way:
// on the next launch nothing that was saved before is lost, nothing deleted comes back, nothing
// half-written reaches a screen, and whatever reached the disk whole is there.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Hand } from '@/poker/types';

import { QUARANTINE, SPECS, loadAll } from '../boot';
import { createWriter } from '../persist';
import { FakeStorage, bigHistory } from './fake-storage';

const DELETED = 'rl.deleted.v1';
const H = SPECS.hands;

/**
 * Storage that dies after `budget` key writes or removals, one key at a time (iOS writes a
 * multiSet key by key). `torn`: the key being written when it dies keeps only half its value.
 */
class DyingStorage extends FakeStorage {
  dead = false;
  constructor(
    public budget: number,
    private torn = false,
  ) {
    super();
  }
  private spend() {
    if (this.dead) throw new Error('killed');
    if (this.budget-- <= 0) {
      this.dead = true;
      throw new Error('killed');
    }
  }
  override async multiSet(pairs: [string, string][]) {
    for (const [k, v] of pairs) {
      if (this.budget <= 0 && this.torn && !this.dead) this.data.set(k, v.slice(0, Math.floor(v.length / 2)));
      this.spend();
      this.data.set(k, v);
    }
  }
  override async multiRemove(keys: readonly string[]) {
    for (const k of keys) {
      this.spend();
      this.data.delete(k);
    }
  }
  /** The phone after the kill: the same bytes, writes allowed again. */
  reopen(): FakeStorage {
    const kv = new FakeStorage();
    kv.data = new Map(this.data);
    return kv;
  }
}

async function saved(kv: FakeStorage, hands: Hand[]) {
  const w = createWriter<Hand>(kv, H, [], () => {}, 0);
  w.schedule(hands);
  await w.flush();
}

const byId = (l: Hand[]) => new Map(l.map((h) => [h.id, h]));

test('killed at every point of a restore: what was there stays, every hand that reached the disk is there', async () => {
  const before = bigHistory(30, Date.UTC(2026, 0, 1));
  const incoming = bigHistory(900, Date.UTC(2025, 0, 1)).map((h) => ({ ...h, id: 'in' + h.id }));
  const next = [...before, ...incoming];
  for (const torn of [false, true]) {
    for (let n = 0; n <= incoming.length + 1; n += torn ? 37 : 13) {
      const kv = new DyingStorage(Infinity, torn);
      await saved(kv, before);
      kv.budget = n;
      const w = createWriter<Hand>(kv, H, before, () => {}, 0);
      w.schedule(next);
      await w.flush();
      const after = kv.reopen();
      const d = await loadAll(after);
      const got = byId(d.hands.items);
      for (const h of before) assert.deepEqual(got.get(h.id), h, `n=${n}: ${h.id} lost`);
      // Every incoming hand whose value is whole on disk.
      const whole = incoming.filter((h) => kv.data.get(H.prefix + h.id) === JSON.stringify(h));
      for (const h of whole) assert.deepEqual(got.get(h.id), h, `n=${n} torn=${torn}: ${h.id} on disk but not loaded`);
      assert.equal(d.hands.items.length, before.length + whole.length, `n=${n}`);
      // A half-written one goes to quarantine, never to a screen.
      if (torn && n < incoming.length) assert.ok([...after.data.keys()].some((k) => k.startsWith(QUARANTINE)) || d.quarantined > 0, `n=${n}: torn value not set aside`);
    }
  }
});

test('killed at every point of a save with an edit, a new hand and a delete: the delete never comes back', async () => {
  const before = bigHistory(12, Date.UTC(2026, 0, 1));
  const edited = { ...before[3], notes: 'editada', updatedAt: before[3].updatedAt + 1000 };
  const fresh = { ...before[0], id: 'novo', createdAt: before[0].createdAt + 1, updatedAt: before[0].updatedAt + 2000 };
  const gone = before[7];
  const next = [fresh, ...before.filter((h) => h !== gone).map((h) => (h.id === edited.id ? edited : h))];
  // Pairs written: the edit, the new hand, the index; then the removal.
  for (let n = 0; n <= 4; n++) {
    const kv = new DyingStorage(Infinity);
    await saved(kv, before);
    // The store marks the delete before the list is written (deleted.ts).
    await kv.setItem(DELETED, JSON.stringify({ [`hands:${gone.id}`]: gone.updatedAt + 5000 }));
    kv.budget = n;
    const w = createWriter<Hand>(kv, H, before, () => {}, 0);
    w.schedule(next);
    await w.flush();
    const after = kv.reopen();
    const d = await loadAll(after);
    const got = byId(d.hands.items);
    assert.ok(!got.has(gone.id), `n=${n}: the deleted hand came back`);
    for (const h of before) if (h !== gone && h.id !== edited.id) assert.deepEqual(got.get(h.id), h, `n=${n}`);
    assert.ok([before[3], edited].some((x) => JSON.stringify(x) === JSON.stringify(got.get(edited.id))), `n=${n}: the edited hand is neither version`);
    if (kv.data.get(H.prefix + fresh.id) === JSON.stringify(fresh)) assert.deepEqual(got.get(fresh.id), fresh, `n=${n}: the new hand was on disk but not loaded`);
    // The deleted hand's value doesn't stay on the phone taking space.
    assert.ok(!after.data.has(H.prefix + gone.id) || n < 3, `n=${n}: the deleted hand's value is still there`);
  }
});

test('the phone fills up half-way through a restore: told once, nothing lost, and it finishes once there is room', async () => {
  const before = bigHistory(40, Date.UTC(2026, 0, 1));
  const incoming = bigHistory(1500, Date.UTC(2024, 0, 1)).map((h) => ({ ...h, id: 'in' + h.id }));
  const kv = new FakeStorage();
  await saved(kv, before);
  const used = kv.totalBytes;
  // Room for about half of what comes in.
  (kv as unknown as { opts: { dbLimit?: number } }).opts.dbLimit = used + (JSON.stringify(incoming).length * 0.5);
  const errors: unknown[] = [];
  const w = createWriter<Hand>(kv, H, before, (e) => errors.push(e), 0);
  w.schedule([...before, ...incoming]);
  await w.flush();
  await w.flush();
  assert.equal(errors.length, 1, 'told once, not on every retry');
  let d = await loadAll(kv);
  const got = byId(d.hands.items);
  for (const h of before) assert.deepEqual(got.get(h.id), h);
  // What fitted before the disk filled is not left on the phone unseen.
  const onDisk = incoming.filter((h) => kv.data.has(H.prefix + h.id));
  assert.equal(d.hands.items.length, before.length + onDisk.length);
  // Room again: the next write finishes the job.
  (kv as unknown as { opts: { dbLimit?: number } }).opts.dbLimit = undefined;
  await w.flush();
  d = await loadAll(kv);
  assert.equal(d.hands.items.length, before.length + incoming.length);
});
