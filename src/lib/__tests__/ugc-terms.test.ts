import assert from 'node:assert/strict';
import { test } from 'node:test';

import { UGC_TERMS_KEY, ugcTerms } from '../ugc-terms';

function memory() {
  const m = new Map<string, string>();
  return { m, kv: { getItem: async (k: string) => m.get(k) ?? null, setItem: async (k: string, v: string) => void m.set(k, v) } };
}

test('asks once, remembers the «Aceito» and never asks again', async () => {
  const { m, kv } = memory();
  const g = ugcTerms(kv);
  let asked = 0;
  g.setAsker(async () => (asked++, true));
  assert.equal(await g.accept(), true);
  assert.equal(await g.accept(), true);
  assert.equal(asked, 1);
  assert.ok(m.get(UGC_TERMS_KEY));
  // A new launch reads it from storage.
  const again = ugcTerms(kv);
  again.setAsker(async () => (asked++, true));
  assert.equal(await again.accept(), true);
  assert.equal(asked, 1);
});

test('a «no» publishes nothing and asks again next time', async () => {
  const { m, kv } = memory();
  const g = ugcTerms(kv);
  const answers = [false, true];
  g.setAsker(async () => answers.shift()!);
  assert.equal(await g.accept(), false);
  assert.equal(m.has(UGC_TERMS_KEY), false);
  assert.equal(await g.accept(), true);
});

test('without the sheet mounted nothing is accepted', async () => {
  const { kv } = memory();
  assert.equal(await ugcTerms(kv).accept(), false);
});

test('two taps at once show one sheet', async () => {
  const { kv } = memory();
  const g = ugcTerms(kv);
  let asked = 0;
  let answer: (v: boolean) => void = () => {};
  g.setAsker(() => (asked++, new Promise((r) => (answer = r))));
  const a = g.accept();
  const b = g.accept();
  await new Promise((r) => setTimeout(r, 0));
  answer(true);
  assert.deepEqual(await Promise.all([a, b]), [true, true]);
  assert.equal(asked, 1);
});

test('after erasing all data it asks again', async () => {
  const { m, kv } = memory();
  const g = ugcTerms(kv);
  let asked = 0;
  g.setAsker(async () => (asked++, true));
  await g.accept();
  m.delete(UGC_TERMS_KEY);
  g.forget();
  await g.accept();
  assert.equal(asked, 2);
});
