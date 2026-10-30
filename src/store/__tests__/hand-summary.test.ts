/// <reference types="node" />
// Each hand's result and completeness, kept on the phone so a launch replays only new hands.
// A kept answer is used only for the same hand version and the same app build; anything else is
// replayed. Every "launch" here uses fresh copies of the hands, as the store does.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isComplete, replay } from '../../poker/engine';
import type { Hand } from '../../poker/types';
import { computeSummary, forgetSummaries, handSummary, loadSummaries, saveSummaries, SUMMARY_PREFIX, summaryKey } from '../hand-summary';
import { FakeStorage } from './fake-storage';
import { randomHand } from '../../poker/__tests__/random-hand';
import { bigSessionsAndHands } from '../../../scripts/big-history';

const BUILD = '1:1.0.0';
const launch = (hands: Hand[]) => {
  forgetSummaries();
  return hands.map((h) => structuredClone(h));
};
const kept = (kv: FakeStorage) => [...kv.data.entries()].filter(([k]) => k.startsWith(SUMMARY_PREFIX));

test('a summary is what replaying the hand says', () => {
  for (let i = 1; i <= 2000; i++) {
    const h = randomHand(i);
    const r = replay(h);
    assert.deepEqual(computeSummary(h), { net: r.result?.resolved ? r.result.net[h.hero] : undefined, raw: r.result?.net[h.hero], done: isComplete(h, r) }, h.id);
  }
});

test('kept on the phone and read back on the next launch: the same answers for the whole history', async () => {
  const kv = new FakeStorage();
  const { hands } = bigSessionsAndHands(300, 10);
  const first = launch(hands).map(handSummary);
  assert.equal(await saveSummaries(kv, BUILD, hands), true);
  const next = launch(hands);
  assert.equal(await loadSummaries(kv, BUILD), hands.length);
  assert.deepEqual(next.map(handSummary), first);
  // Nothing new worked out: nothing written again.
  assert.equal(await saveSummaries(kv, BUILD, next), false);
});

test('a kept answer is used only for the same hand version and build', async () => {
  const kv = new FakeStorage();
  const h = randomHand(3);
  const real = computeSummary(h);
  // Planted values tell whether the kept answer was used.
  const plant = (key: string, build = BUILD) => kv.data.set(SUMMARY_PREFIX + 0, JSON.stringify({ b: build, e: [[h.id, key, 12345, 12345, 1]] }));

  plant(summaryKey(h));
  let [x] = launch([h]);
  await loadSummaries(kv, BUILD);
  assert.deepEqual(handSummary(x), { net: 12345, raw: 12345, done: true });

  // Edited (every save moves updatedAt): replayed.
  [x] = launch([{ ...h, updatedAt: h.updatedAt + 1 }]);
  await loadSummaries(kv, BUILD);
  assert.deepEqual(handSummary(x), real);

  // Same updatedAt but an action more (a copy changed without a save): replayed.
  plant(summaryKey(h));
  [x] = launch([{ ...h, actions: [...h.actions, { p: 0, kind: 'fold' }] }]);
  await loadSummaries(kv, BUILD);
  assert.notEqual(handSummary(x).raw, 12345);

  // Kept by another app version: replayed.
  plant(summaryKey(h), '1:0.9.0');
  [x] = launch([h]);
  assert.equal(await loadSummaries(kv, BUILD), 0);
  assert.deepEqual(handSummary(x), real);
});

test('unreadable or odd values are skipped, never trusted, never a crash', async () => {
  const kv = new FakeStorage();
  const h = randomHand(5);
  kv.data.set(SUMMARY_PREFIX + 0, '{"b":"1:1.0.0","e":[[');
  kv.data.set(SUMMARY_PREFIX + 1, JSON.stringify({ b: BUILD, e: [null, 'x', [h.id, 7], [h.id, summaryKey(h), 'a', null, 2]] }));
  kv.data.set(SUMMARY_PREFIX + 2, JSON.stringify(null));
  const [x] = launch([h]);
  await loadSummaries(kv, BUILD);
  // The one usable row: numbers that aren't numbers are no result, anything but 1 is not done.
  assert.deepEqual(handSummary(x), { net: undefined, raw: undefined, done: false });
  const broken = new FakeStorage();
  broken.getAllKeys = async () => {
    throw new Error('disk');
  };
  assert.equal(await loadSummaries(broken, BUILD), 0);
});

test('deleted hands drop out; a long history is split under Android\'s value limit', async () => {
  const kv = new FakeStorage();
  const { hands } = bigSessionsAndHands(1000, 10);
  launch(hands).forEach(handSummary);
  await saveSummaries(kv, BUILD, hands);
  const rows = kept(kv);
  assert.equal(rows.length, 3);
  assert.ok(rows.every(([, v]) => v.length < 512 * 1024));
  // 2 000 hands left: one value, the others removed.
  const left = hands.slice(0, 2000);
  assert.equal(await saveSummaries(kv, BUILD, left), true);
  assert.equal(kept(kv).length, 1);
  launch(left);
  assert.equal(await loadSummaries(kv, BUILD), 2000);
});

test('after «Apagar todos os meus dados» nothing kept in memory is written back', async () => {
  const kv = new FakeStorage();
  const hands = launch([randomHand(8), randomHand(9)]);
  hands.forEach(handSummary);
  forgetSummaries();
  await saveSummaries(kv, BUILD, hands);
  assert.equal(kept(kv).length, 0);
});

test('a launch with everything kept costs a fraction of replaying', async () => {
  const kv = new FakeStorage();
  const { hands } = bigSessionsAndHands(500, 10);
  launch(hands).forEach(handSummary);
  await saveSummaries(kv, BUILD, hands);
  let t = performance.now();
  launch(hands).forEach((h) => replay(h));
  const replayed = performance.now() - t;
  const fresh = launch(hands);
  t = performance.now();
  await loadSummaries(kv, BUILD);
  fresh.forEach(handSummary);
  const read = performance.now() - t;
  assert.ok(read < replayed / 3, `${read.toFixed(0)} ms vs ${replayed.toFixed(0)} ms`);
});

test('the hands list, its rows and the CSV take the kept answers', async () => {
  const { readFileSync } = await import('node:fs');
  const path = await import('node:path');
  const read = (f: string) => readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
  const list = read('app/(tabs)/hands.tsx');
  // Counted once what the phone kept is read, then kept again for the next launch.
  assert.match(list, /useIdleCount\(summariesRead \? hands : NO_HANDS, isIncomplete, summariesRead \? persistSummaries : undefined\)/);
  assert.match(read('components/HandRow.tsx'), /return handSummary\(hand\);/);
  assert.doesNotMatch(read('components/HandRow.tsx'), /replay\(/);
  assert.match(read('export/report.ts'), /net = handSummary\(h\)\.raw;/);
  assert.match(read('app/export.tsx'), /await summariesReady\(\);\s*const csv = handsCsv\(/);
  // «Apagar todos os meus dados» empties what is in memory too.
  assert.match(read('lib/hand-summaries.ts'), /onEraseAll\(\(\) => \{[^}]*forgetSummaries\(\);/);
  // An over-the-air update can change the engine without a new app version: it starts over too.
  assert.match(read('lib/hand-summaries.ts'), /const build = \(\) => `\$\{SUMMARY_VERSION\}:\$\{Constants\.expoConfig\?\.version \?\? '0'\}:\$\{Updates\.updateId \?\? 'embedded'\}`/);
});
