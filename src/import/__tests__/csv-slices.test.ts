/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { detectSeparator, parseCsv, parseCsvAsync, readTable, readTableAsync } from '../csv';
import { prepare, prepareAsync, toSessions } from '../convert';
import { knownHeader } from '../mapping';

// Reading a file in steps (so the progress bar can draw on a cheap phone) must give exactly
// what one pass gives: same rows, same table, same sessions.

const now = () => Promise.resolve();
// A pause after every step (every 200 rows): the most boundaries a file can have.
const everyStep = { sliceMs: -1, pause: now };

let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];

/** Cells with separators, "" quotes and line breaks inside quotes, around every 200-row boundary. */
function tricky(rows: number, sep = ',', nl = '\n'): string {
  const cell = (r: number) =>
    r % 200 >= 195 || r % 200 <= 4 || rnd() < 0.1
      ? `"${pick(['linha' + nl + 'partida', 'a' + sep + ' b', 'diz ""olá""', nl + nl + 'três' + nl, '"" no início', 'fim' + nl])}"`
      : pick(['100', '-12,5', 'Casino Estoril', '', '2026-10-19 20:00', 'Omaha Hi-Lo']);
  const out = ['date' + sep + 'game' + sep + 'notes' + sep + 'profit'];
  for (let r = 0; r < rows; r++) out.push(`2026-01-${String((r % 28) + 1).padStart(2, '0')}${sep}${cell(r)}${sep}${cell(r)}${sep}${r}`);
  return out.join(nl) + nl;
}

test('parseCsvAsync gives the same rows as parseCsv, with quoted line breaks across every step boundary', async () => {
  for (const [sep, nl] of [[',', '\n'], [';', '\r\n'], ['\t', '\n'], [',', '\r']]) {
    const text = tricky(2_050, sep, nl);
    const one = parseCsv(text, sep);
    assert.ok(one.length > 2_000);
    assert.deepEqual(await parseCsvAsync(text, sep, everyStep), one, JSON.stringify(sep + nl));
    assert.deepEqual(await parseCsvAsync(text, sep), one);
  }
});

test('odd endings and a quote that never closes read the same in steps', async () => {
  const cases = [
    '',
    'a,b',
    'a,b\n',
    '﻿a,b\n1,2',
    'a,b\n' + '1,"never closed\n2,3\n'.repeat(300),
    'a,b\n' + '1,"x"y,2\n'.repeat(450),
    "a,b\n'=1+1,'-5\n".repeat(250),
    'a,b\r\n\r\n,\r\n'.repeat(300),
  ];
  for (const text of cases) assert.deepEqual(await parseCsvAsync(text, ',', everyStep), parseCsv(text, ','), JSON.stringify(text.slice(0, 30)));
});

test('the progress counts up through the text and a cancelled read returns null', async () => {
  const text = tricky(1_000);
  const seen: number[] = [];
  await parseCsvAsync(text, ',', { ...everyStep, onProgress: (done, total) => (assert.equal(total, text.length), seen.push(done)) });
  assert.ok(seen.length >= 4);
  assert.deepEqual([...seen].sort((a, b) => a - b), seen);
  assert.ok(seen[seen.length - 1] <= text.length);
  let steps = 0;
  assert.equal(await parseCsvAsync(text, ',', { ...everyStep, cancelled: () => ++steps > 1 }), null);
});

/** detectSeparator as it was: every line of the text split. */
function oldDetect(text: string): string {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !/^-+[^,;\t]*-*$/.test(l.trim()))
    .slice(0, 20);
  const count = (l: string, sep: string) => {
    let n = 0;
    let q = false;
    for (const ch of l) {
      if (ch === '"') q = !q;
      else if (ch === sep && !q) n++;
    }
    return n;
  };
  let best = ',';
  let bestScore = 0;
  for (const sep of [',', ';', '\t']) {
    const counts = lines.map((l) => count(l, sep));
    if (!Math.max(0, ...counts)) continue;
    const m = new Map<number, number>();
    for (const x of counts.filter((c) => c > 0)) m.set(x, (m.get(x) ?? 0) + 1);
    let mode = 0;
    let modeN = 0;
    for (const [x, n] of m) if (n > modeN || (n === modeN && x > mode)) [mode, modeN] = [x, n];
    const score = counts.filter((c) => c === mode).length * Math.log2(mode + 1);
    if (score > bestScore) [best, bestScore] = [sep, score];
  }
  return best;
}

test('the separator is read from the start of the file only, with the same answer', () => {
  const junk = (n: number) => '---\n'.repeat(n);
  const cases = [
    tricky(3_000, ';'),
    tricky(3_000, '\t', '\r\n'),
    junk(40_000) + tricky(30, ';'),
    junk(40_000) + 'a;b;c\n',
    '﻿' + tricky(10, ';'),
    'x'.repeat(70_000) + ';y\n1;2\n',
    'a;b\r\n'.repeat(13_107) + 'a,b,c,d\r\n'.repeat(30),
    '\n'.repeat(65_536) + 'a\tb\n1\t2',
    'a;b',
    '',
  ];
  for (const text of cases) assert.equal(detectSeparator(text), oldDetect(text), JSON.stringify(text.slice(-30)));
});

test('prepareAsync and readTableAsync give what prepare and readTable give, down to the sessions', async () => {
  const pbt =
    '---\n---PBT Bankroll Export---\nid,starttime,endtime,variant,game,limit,location,currency,buyin,cashout,netprofit,mttname,sessionnote\n' +
    Array.from({ length: 1_500 }, (_, i) => `${i},2025-0${(i % 9) + 1}-1${i % 10} 20:00:00,2025-0${(i % 9) + 1}-1${i % 10} 23:30:00,${i % 3 ? 'Cash Game' : 'Tournament'},Holdem,No Limit,"Casino, Lisboa",${pick(['EUR', 'USD', 'GBP'])},100,${i % 7 ? 150 : 0},${i % 7 ? 50 : -100},${i % 3 ? '' : 'WSOP_Main 12-2A'},"nota ${i % 50 ? '' : 'com\nlinha'}"`).join('\n');
  for (const text of [pbt, tricky(1_200), tricky(800, ';', '\r\n')]) {
    assert.deepEqual(await readTableAsync(text, knownHeader, everyStep), readTable(text, knownHeader));
    const a = prepare(text);
    const b = (await prepareAsync(text, everyStep))!;
    assert.deepEqual(b, a);
    const opt = { currency: '€', tableSize: 9, source: a.source };
    assert.deepEqual(toSessions(b.table, b.mapping, opt), toSessions(a.table, a.mapping, opt));
  }
  assert.equal(await prepareAsync(tricky(1_000), { ...everyStep, cancelled: () => true }), null);
});
