/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isOnline, observeFetch, onReconnect, reportNetwork } from '../online';
import { MAX_AGE_MS, backoff, createOutbox, type Outcome } from '../outbox';

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
