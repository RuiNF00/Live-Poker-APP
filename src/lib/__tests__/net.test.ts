/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { withTimeout } from '../net';

// A server that never answers, but honours abort like real fetch does.
const hanging = ((_: unknown, init?: RequestInit) =>
  new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))) as unknown as typeof fetch;

test('a request that never answers fails after the limit', async () => {
  const f = withTimeout(hanging, 30);
  const t0 = Date.now();
  await assert.rejects(f('https://x.test'), /aborted/);
  assert.ok(Date.now() - t0 < 1000);
});

test('a caller-supplied signal is left alone', async () => {
  let seen: AbortSignal | undefined | null;
  const ctrl = new AbortController();
  const f = withTimeout((async (_: unknown, init?: RequestInit) => {
    seen = init?.signal;
    return new Response('ok');
  }) as unknown as typeof fetch, 30);
  await f('https://x.test', { signal: ctrl.signal });
  assert.equal(seen, ctrl.signal);
});

test('a fast answer goes through untouched', async () => {
  const f = withTimeout((async () => new Response('ok', { status: 201 })) as unknown as typeof fetch, 30);
  const r = await f('https://x.test', { method: 'POST' });
  assert.equal(r.status, 201);
});
