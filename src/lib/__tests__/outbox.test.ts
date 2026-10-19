/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isOnline, observeFetch, onReconnect, probeWhileOffline, reportNetwork } from '../online';
import { MAX_AGE_MS, MAX_JOBS, MAX_TRIES, backoff, createOutbox, keptBackoff, type Outcome } from '../outbox';

function mem() {
  const m = new Map<string, string>();
  return { m, getItem: async (k: string) => m.get(k) ?? null, setItem: async (k: string, v: string) => void m.set(k, v) };
}

test('offline: jobs wait on the phone, survive a restart, and go out when the signal is back', async () => {
  const kv = mem();
  let up = false;
  const sent: unknown[] = [];
  const send = async (p: unknown): Promise<Outcome> => {
    if (!up) throw new TypeError('Network request failed');
    sent.push(p);
    return 'done';
  };
  let clock = 1000;
  const a = createOutbox(kv, { event: send }, { now: () => clock });
  await a.enqueue('event', { n: 1 });
  await a.enqueue('event', { n: 2 });
  await a.drain();
  assert.equal(await a.size(), 2);
  assert.deepEqual(sent, []);

  // App killed and reopened, still offline: nothing lost.
  const b = createOutbox(kv, { event: send }, { now: () => clock });
  assert.equal(await b.size(), 2);

  up = true;
  clock += 1000;
  await b.drain(); // the first one is still waiting out its backoff; the second was never tried
  assert.deepEqual(sent, [{ n: 2 }]);
  await b.drain(true); // reconnect forces a try
  assert.deepEqual(sent, [{ n: 2 }, { n: 1 }]);
  assert.equal(await b.size(), 0);
});

test('same kind and key: only the latest is kept', async () => {
  const kv = mem();
  const box = createOutbox(kv, {});
  await box.enqueue('invite-claim', { code: 'a' }, 'claim');
  await box.enqueue('invite-claim', { code: 'b' }, 'claim');
  assert.equal(await box.size(), 1);
  assert.deepEqual(JSON.parse(kv.m.get('rl.outbox.v1')!)[0].payload, { code: 'b' });
});

test('a job the server rejects is dropped; one it refuses for now is retried later', async () => {
  const kv = mem();
  const out: Outcome[] = ['drop', 'retry'];
  let clock = 0;
  const box = createOutbox(kv, { x: async () => out.shift()! }, { now: () => clock });
  await box.enqueue('x', 1);
  await box.enqueue('x', 2);
  await box.drain();
  assert.equal(await box.size(), 1);
  assert.equal(await box.nextDue(), backoff(1));
});

test('old jobs and unknown kinds are cleaned up', async () => {
  const kv = mem();
  let clock = 0;
  const box = createOutbox(kv, { x: async () => 'retry' as Outcome }, { now: () => clock });
  await box.enqueue('x', 1);
  await box.enqueue('gone', 2);
  clock = MAX_AGE_MS + 1;
  await box.drain(true);
  assert.equal(await box.size(), 0);
});

test('backoff grows and is capped at 10 minutes', () => {
  assert.equal(backoff(1), 5000);
  assert.equal(backoff(2), 10000);
  assert.equal(backoff(30), 600000);
});

test('online state follows what requests do, and reconnect fires once', async () => {
  let back = 0;
  const off = onReconnect(() => back++);
  const failing = observeFetch((async () => {
    throw new TypeError('Network request failed');
  }) as unknown as typeof fetch);
  const working = observeFetch((async () => new Response(null, { status: 404 })) as unknown as typeof fetch);
  await assert.rejects(failing('https://x.test'));
  assert.equal(isOnline(), false);
  await working('https://x.test'); // any answer, even 404, means online
  assert.equal(isOnline(), true);
  await working('https://x.test');
  assert.equal(back, 1);
  off();
  reportNetwork(true);
});

test('the offline probe works against a cross-origin API without CORS (web)', async () => {
  const real = globalThis.fetch;
  const modes: (string | undefined)[] = [];
  // Like a browser: a cross-origin request needs CORS unless it is no-cors (opaque answer).
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    modes.push(init?.mode);
    if (init?.mode !== 'no-cors') throw new TypeError('Failed to fetch');
    return new Response(null, { status: 200 });
  }) as unknown as typeof fetch;
  try {
    reportNetwork(false);
    probeWhileOffline('https://api.other-origin.test');
    await new Promise((r) => setTimeout(r, 0));
    assert.deepEqual(modes, ['no-cors']);
    assert.equal(isOnline(), true);
  } finally {
    globalThis.fetch = real;
    reportNetwork(true);
  }
});

test('a job about something deleted can be forgotten before it goes out', async () => {
  const kv = mem();
  const sent: unknown[] = [];
  const box = createOutbox(kv, { 'share-upload': async (p) => (sent.push(p), 'done') });
  await box.enqueue('share-upload', { hand: 'a' }, 'a');
  await box.enqueue('share-upload', { hand: 'b' }, 'b');
  assert.equal(await box.cancel('share-upload', 'a'), true);
  assert.equal(await box.cancel('share-upload', 'a'), false);
  await box.drain();
  assert.deepEqual(sent, [{ hand: 'b' }]);
  // Gone from storage too, so a restart doesn't bring it back.
  assert.equal(await createOutbox(kv, {}).size(), 0);
});

test('has: a job waits until it is sent, then it is gone', async () => {
  const kv = mem();
  let up = false;
  const box = createOutbox(kv, { make: async () => (up ? 'done' : 'retry') });
  await box.enqueue('make', {}, 'k1');
  assert.equal(await box.has('make', 'k1'), true);
  assert.equal(await box.has('make', 'k2'), false);
  await box.drain(true);
  assert.equal(await box.has('make', 'k1'), true);
  up = true;
  await box.drain(true);
  assert.equal(await box.has('make', 'k1'), false);
});

test('quiet kinds go out but are not counted as waiting', async () => {
  const kv = mem();
  const box = createOutbox(kv, { event: async () => 'retry', share: async () => 'retry' }, { quiet: ['event'] });
  const seen: number[] = [];
  box.subscribe((n) => seen.push(n));
  await box.enqueue('event', { e: 1 });
  await box.enqueue('event', { e: 2 });
  await box.enqueue('share', { h: 1 });
  assert.equal(await box.size(), 1);
  assert.equal(seen.at(-1), 1);
});

test('a promised delete is never given up on: not after many tries, not after weeks, not pushed out by events', async () => {
  const kv = mem();
  let clock = 0;
  let up = false;
  const sent: unknown[] = [];
  const send = async (p: unknown): Promise<Outcome> => {
    if (!up) return 'retry';
    sent.push(p);
    return 'done';
  };
  const senders: Record<string, (p: unknown) => Promise<Outcome>> = { 'cloud-delete': send, event: async () => 'retry' };
  const box = createOutbox(kv, senders, { now: () => clock, keep: ['cloud-delete', 'offer-delete'] });
  await box.enqueue('cloud-delete', { id: 'c' }, 'c');
  // Queued before its sender is registered (a feature that loads later): it waits instead of being dropped.
  await box.enqueue('offer-delete', { id: 'o' }, 'o');
  for (let i = 0; i < MAX_TRIES + 5; i++) {
    clock += 60_000;
    await box.drain(true);
  }
  clock += MAX_AGE_MS * 2;
  for (let i = 0; i < MAX_JOBS + 10; i++) await box.enqueue('event', { i });
  await box.drain(true);
  const after = createOutbox(kv, senders, { now: () => clock, keep: ['cloud-delete', 'offer-delete'] });
  assert.ok(await after.has('cloud-delete', 'c'));
  assert.ok(await after.has('offer-delete', 'o'));
  up = true;
  senders['offer-delete'] = send;
  await after.drain(true);
  assert.deepEqual(sent, [{ id: 'c' }, { id: 'o' }]);
  assert.equal(await after.has('cloud-delete', 'c'), false);
});

test('a promised delete past MAX_TRIES waits 6 h between tries, not 10 min, and is still kept', async () => {
  assert.equal(keptBackoff(MAX_TRIES), backoff(MAX_TRIES));
  assert.equal(keptBackoff(MAX_TRIES + 1), 6 * 3600_000);
  const kv = mem();
  let clock = 0;
  const box = createOutbox(kv, { 'cloud-delete': async () => 'retry' as Outcome, x: async () => 'retry' as Outcome }, { now: () => clock, keep: ['cloud-delete'] });
  await box.enqueue('cloud-delete', {}, 'c');
  for (let i = 0; i < MAX_TRIES + 1; i++) await box.drain(true);
  assert.equal(await box.nextDue(), 6 * 3600_000);
  // Other kinds keep the 10-minute cap.
  assert.equal(backoff(MAX_TRIES + 1), 600000);
  assert.ok(await box.has('cloud-delete', 'c'));
});

test('enqueue throws when the job could not be saved; drain keeps going on a failed write', async () => {
  const kv = mem();
  let broken = true;
  const flaky = { getItem: kv.getItem, setItem: async (k: string, v: string) => (broken ? Promise.reject(new Error('disk')) : kv.setItem(k, v)) };
  const box = createOutbox(flaky, { x: async () => 'done' as Outcome });
  await assert.rejects(box.enqueue('x', 1, 'k'), /disk/);
  // Sending and its bookkeeping never throw.
  await box.drain(true);
  broken = false;
  await box.enqueue('x', 2, 'k');
  assert.equal(JSON.parse(kv.m.get('rl.outbox.v1')!)[0].payload, 2);
});

test('a job that could not be saved is not sent from memory either', async () => {
  const kv = mem();
  let broken = true;
  const flaky = { getItem: kv.getItem, setItem: async (k: string, v: string) => (broken ? Promise.reject(new Error('disk')) : kv.setItem(k, v)) };
  const sent: unknown[] = [];
  const box = createOutbox(flaky, { del: async (p) => (sent.push(p), 'done' as Outcome) });
  await assert.rejects(box.enqueue('del', { id: 'x' }, 'x'), /disk/);
  broken = false;
  await box.drain(true);
  assert.deepEqual(sent, []);
  assert.equal(await box.size(), 0);
});
