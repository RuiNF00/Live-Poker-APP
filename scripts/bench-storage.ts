// Measures what a big history costs: npm run bench
// Compares the old storage (one JSON array per list) with the per-hand layout,
// and times the list work the hands and players screens do.

import { performance } from 'node:perf_hooks';

import { createWriter, loadCollection } from '../src/store/persist';
import { handCounts } from '../src/store/queries';
import { ANDROID_ROW_LIMIT, FakeStorage, bigHistory } from '../src/store/__tests__/fake-storage';
import type { Hand } from '../src/poker/types';
import type { PlayerNote } from '../src/store/types';

const N = Number(process.argv[2] ?? 2000);
const SPEC = { index: 'rl.hands.v2', prefix: 'rl.hand.v2.', legacy: 'rl.hands.v1' };

function time<T>(fn: () => T, runs = 20): { ms: number; out: T } {
  let out = fn();
  const t0 = performance.now();
  for (let i = 0; i < runs; i++) out = fn();
  return { ms: (performance.now() - t0) / runs, out };
}
async function timeAsync<T>(fn: () => Promise<T>, runs = 5): Promise<{ ms: number; out: T }> {
  let out = await fn();
  const t0 = performance.now();
  for (let i = 0; i < runs; i++) out = await fn();
  return { ms: (performance.now() - t0) / runs, out };
}
const f = (ms: number) => (ms < 1 ? ms.toFixed(2) : ms.toFixed(1)) + ' ms';
const kb = (b: number) => (b / 1024).toFixed(0) + ' KB';

async function main() {
  const hands = bigHistory(N);
  const rows: [string, string, string][] = [];

  // Saving one hand.
  const oldSave = time(() => JSON.stringify(hands).length);
  const kv = new FakeStorage();
  const w = createWriter<Hand>(kv, SPEC, [], () => {});
  w.schedule(hands);
  await w.flush();
  const before = kv.bytesWritten;
  const edited = [{ ...hands[0], id: 'h_new' }, ...hands];
  w.schedule(edited);
  await w.flush();
  rows.push(['Guardar 1 mão: escrito no disco', kb(oldSave.out), kb(kv.bytesWritten - before)]);
  const newSave = time(() => JSON.stringify(edited[0]).length + JSON.stringify(edited.map((h) => h.id)).length);
  rows.push(['Guardar 1 mão: tempo de CPU', f(oldSave.ms), f(newSave.ms)]);

  // Opening the app.
  const blob = JSON.stringify(hands);
  const oldLoad = time(() => (JSON.parse(blob) as Hand[]).length, 10);
  const items = hands.map((h) => JSON.stringify(h));
  const newLoad = time(() => items.map((s) => JSON.parse(s) as Hand).length, 10);
  rows.push(['Abrir a app: decodificar as mãos', f(oldLoad.ms), f(newLoad.ms)]);
  const loaded = await timeAsync(() => loadCollection<Hand>(kv, SPEC));
  if (loaded.out.items.length !== edited.length) throw new Error('load mismatch');
  const droid = new FakeStorage({ rowLimit: ANDROID_ROW_LIMIT });
  await droid.setItem(SPEC.legacy, blob);
  const oldDroid = await droid.getItem(SPEC.legacy).then(() => 'abre', () => 'FALHA (lista vazia)');
  rows.push(['Abrir no Android (limite 2 MB por valor)', oldDroid, 'abre']);

  // Hands list: sort + search (old: rebuilt the search text on every keystroke).
  const oldSearch = time(() => [...hands].sort((a, b) => b.createdAt - a.createdAt).filter((h) => [h.game.name, h.notes, h.title, ...h.players.map((p) => p.name)].join(' ').toLowerCase().includes('alemão')).length);
  const cache = new WeakMap<Hand, string>();
  const sorted = [...hands].sort((a, b) => b.createdAt - a.createdAt);
  const st = (h: Hand) => {
    let s = cache.get(h);
    if (s === undefined) cache.set(h, (s = [h.game.name, h.notes, h.title, ...h.players.map((p) => p.name)].join(' ').toLowerCase()));
    return s;
  };
  const newSearch = time(() => sorted.filter((h) => st(h).includes('alemão')).length);
  rows.push(['Pesquisa na lista: por tecla', f(oldSearch.ms), f(newSearch.ms)]);

  // Players tab with 150 notes.
  const players: PlayerNote[] = Array.from({ length: 150 }, (_, i) => ({ id: 'p' + i, name: i < 8 ? ['Boné azul', 'Reg alemão', 'Miguel', 'Ana', 'Tó', 'Pedro', 'Kid de óculos', 'Senhor do relógio'][i] : 'Jogador ' + i, look: '', tags: [], notes: '', createdAt: 0, updatedAt: 0 }));
  const oldPlayers = time(() => players.map((p) => { const n = p.name.trim().toLowerCase(); return hands.filter((h) => h.players.some((x, i) => i !== h.hero && (x.playerId === p.id || (n && x.name.trim().toLowerCase() === n)))).length; }), 3);
  const newPlayers = time(() => handCounts(hands, players).size, 3);
  rows.push(['Separador Jogadores (150 notas)', f(oldPlayers.ms), f(newPlayers.ms)]);

  console.log(`\n${N} mãos · ${kb(blob.length)} em JSON\n`);
  const w0 = Math.max(...rows.map((r) => r[0].length));
  console.log('O que'.padEnd(w0), ' | Antes'.padEnd(22), ' | Agora');
  for (const [a, b, c] of rows) console.log(a.padEnd(w0), ' | ' + b.padEnd(20), ' | ' + c);
}

main();
