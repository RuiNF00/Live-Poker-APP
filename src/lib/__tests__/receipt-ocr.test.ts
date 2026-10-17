/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { makeReader } from '../receipt-ocr-core';

test('Expo Go: no module (or one that throws on load) is "not available" and reads nothing', async () => {
  for (const load of [() => null, () => { throw new Error("Cannot find native module 'ExpoTextExtractor'"); }]) {
    const r = makeReader(load);
    assert.equal(r.available, false);
    assert.equal(await r.read('file:///x.jpg'), null);
  }
});

test('a store build reads the lines; a failing read is null, not a crash', async () => {
  const ok = makeReader(() => ({ isSupported: true, extractTextFromImage: async (p) => [p] }));
  assert.equal(ok.available, true);
  assert.deepEqual(await ok.read('file:///a/b.jpg'), ['/a/b.jpg']);
  const bad = makeReader(() => ({ isSupported: true, extractTextFromImage: async () => { throw new Error('vision'); } }));
  assert.equal(await bad.read('x'), null);
  assert.equal(makeReader(() => ({ isSupported: false, extractTextFromImage: async () => ['x'] })).available, false);
});
