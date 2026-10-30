/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildBackup, parseBackup } from '../backup';
import { EXTRA_KEYS, withExtras } from '../export-extras';
import { DEFAULT_SETTINGS } from '../types';

const base = buildBackup({ hands: [], sessions: [], players: [], settings: DEFAULT_SETTINGS }, 0);

test('a exportação leva os pacotes, os conjuntos, os links do coach e o treino', () => {
  const out = withExtras(base, [
    [EXTRA_KEYS.actionOffers, JSON.stringify({ o1: { id: 'o1', lines: [] } })],
    [EXTRA_KEYS.handSets, JSON.stringify([{ id: 'p1' }])],
    [EXTRA_KEYS.coachLinks, null],
    [EXTRA_KEYS.drill, '{broken'],
  ]);
  assert.deepEqual(Object.keys(out.alsoOnThisPhone ?? {}), ['actionOffers', 'handSets']);
});

test('sem nada a mais, o ficheiro é a cópia de sempre', () => {
  assert.equal(withExtras(base, []), base);
});

test('o ficheiro com os extras continua a ser restaurado', () => {
  const out = withExtras(base, [[EXTRA_KEYS.handSets, JSON.stringify([{ id: 'p1' }])]]);
  assert.doesNotThrow(() => parseBackup(JSON.stringify(out)));
});
