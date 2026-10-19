import assert from 'node:assert/strict';
import { test } from 'node:test';

import { UGC_TERMS_KEY, ugcTerms } from '../ugc-terms';

function memory() {
  const m = new Map<string, string>();
  return {
    m,
    kv: {
      getItem: async (k: string) => m.get(k) ?? null,
      setItem: async (k: string, v: string) => void m.set(k, v),
    },
  };
}

test('asks once, remembers the «Aceito» and never asks again', async () => {
  const { m, kv } = memory();
  const g = ugcTerms(kv);
  let asked = 0;
  const ask = async () => (asked++, true);
  assert.equal(await g.accept(ask), true);
  assert.equal(await g.accept(ask), true);
  assert.equal(asked, 1);
  assert.ok(m.get(UGC_TERMS_KEY));
  // A new launch reads it from storage.
  assert.equal(await ugcTerms(kv).accept(ask), true);
  assert.equal(asked, 1);
});

test('a «no» publishes nothing and asks again next time', async () => {
  const { m, kv } = memory();
  const g = ugcTerms(kv);
  const answers = [false, true];
  const ask = async () => answers.shift()!;
  assert.equal(await g.accept(ask), false);
  assert.equal(m.has(UGC_TERMS_KEY), false);
  assert.equal(await g.accept(ask), true);
});

test('two taps at once show one sheet', async () => {
  const { kv } = memory();
  const g = ugcTerms(kv);
  let asked = 0;
  let answer: (v: boolean) => void = () => {};
  const ask = () => (asked++, new Promise<boolean>((r) => (answer = r)));
  const a = g.accept(ask);
  const b = g.accept(ask);
  await new Promise((r) => setTimeout(r, 0));
  answer(true);
  assert.deepEqual(await Promise.all([a, b]), [true, true]);
  assert.equal(asked, 1);
});

test('after erasing all data it asks again', async () => {
  const { m, kv } = memory();
  const g = ugcTerms(kv);
  let asked = 0;
  const ask = async () => (asked++, true);
  await g.accept(ask);
  m.delete(UGC_TERMS_KEY);
  g.forget();
  await g.accept(ask);
  assert.equal(asked, 2);
});
