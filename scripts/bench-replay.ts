// What working out every hand's result costs at launch: npm run bench:replay [sessions]
// Replaying every hand (before), the copy-free replay, and a launch that reads what the phone kept
// (store/hand-summary). With `node --jitless --import tsx scripts/bench-replay.ts 2000` it runs
// without the JIT, closer to Hermes on a phone.

import { performance } from 'node:perf_hooks';

import { isComplete, replay, replayFinal } from '../src/poker/engine';
import type { Hand } from '../src/poker/types';
import { forgetSummaries, handSummary, loadSummaries, saveSummaries } from '../src/store/hand-summary';
import { FakeStorage } from '../src/store/__tests__/fake-storage';
import { bigSessionsAndHands } from './big-history';

async function main() {
  const { hands } = bigSessionsAndHands(Number(process.argv[2] ?? 2000));
  // Fresh copies per run, as after a launch: nothing cached in memory.
  const time = async (fn: (hs: Hand[]) => unknown) => {
    const t: number[] = [];
    for (let k = 0; k < 3; k++) {
      forgetSummaries();
      const hs = hands.map((h) => structuredClone(h));
      const t0 = performance.now();
      await fn(hs);
      t.push(performance.now() - t0);
    }
    return t.sort((a, b) => a - b)[1].toFixed(0).padStart(6) + ' ms';
  };
  const kv = new FakeStorage();
  hands.map((h) => structuredClone(h)).forEach(handSummary);
  await saveSummaries(kv, 'bench', hands);
  console.log(`${hands.length} mãos; guardado no telemóvel: ${(kv.totalBytes / 1024).toFixed(0)} KB\n`);
  console.log(`${await time((hs) => hs.forEach((h) => isComplete(h, replay(h))))}  antes: repetir cada mão`);
  console.log(`${await time((hs) => hs.forEach((h) => isComplete(h, replayFinal(h))))}  repetir sem copiar o estado`);
  console.log(`${await time(async (hs) => {
    await loadSummaries(kv, 'bench');
    hs.forEach(handSummary);
  })}  ler o que ficou guardado`);
}

void main();
