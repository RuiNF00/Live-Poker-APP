/// <reference types="node" />
// The «?» beside the less obvious features: two or three short lines, in every language,
// on the screens where the feature lives.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { HELP } from '../../data/help';
import en from '../en';
import es from '../es';
import ptBR from '../pt-BR';

const texts = Object.values(HELP).flatMap((h) => [h.title, ...h.lines]);

test('every help text has English and Spanish, and the Brazilian text where it reads differently', () => {
  assert.deepEqual(texts.filter((s) => !(s in en)), []);
  assert.deepEqual(texts.filter((s) => !(s in es)), []);
  // Lines in the second person read differently in Brazil (tu → você).
  assert.deepEqual(texts.filter((s) => /\b(teu|tua|tocas|jogaste|ganhas|perderes|jogares|recuperares|registas|ficheiro)\b/.test(s) && !(s in ptBR)), []);
});

test('each topic is short: two or three lines that fit a small sheet', () => {
  for (const [k, h] of Object.entries(HELP)) {
    assert.ok(h.lines.length >= 2 && h.lines.length <= 3, k);
    for (const line of h.lines) assert.ok(line.length <= 160, `${k}: ${line.length}`);
  }
});

test('each topic has its «?» on the screen of that feature', () => {
  const where: Record<keyof typeof HELP, string> = {
    icm: 'app/chop.tsx',
    staking: 'app/staking/index.tsx',
    settle: 'app/staking/[id].tsx',
    variance: 'app/variance.tsx',
    interval: 'app/winrate.tsx',
    ruin: 'app/moveup.tsx',
    import: 'app/import.tsx',
  };
  for (const [k, f] of Object.entries(where)) assert.match(readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8'), new RegExp(`help=\\{<Help k="${k}" />\\}`), f);
});

test('the «?» is 44 pt to tap and grows with larger text; an empty staking screen has the help too', () => {
  const h = readFileSync(new URL('../../components/Help.tsx', import.meta.url), 'utf8');
  assert.match(h, /hitSlop=\{14\}/);
  assert.match(h, /Math\.min\(Math\.max\(useWindowDimensions\(\)\.fontScale, 1\), 1\.6\)/);
  const st = readFileSync(new URL('../../app/staking/index.tsx', import.meta.url), 'utf8');
  assert.match(st, /<Help k="staking" label=\{t\('Como funciona\?'\)\} \/>/);
});
