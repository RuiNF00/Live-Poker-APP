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

test('o ficheiro não leva as chaves de dono: ownerToken nem o token de edição dos links de ação', () => {
  const out = withExtras(base, [
    [EXTRA_KEYS.actionOffers, JSON.stringify({ o1: { id: 'o1', lines: [{ id: 'l1', pct: 10, remote: { id: 'r1', token: 'edit-secret', url: 'https://x/o/r1' } }] } })],
    [EXTRA_KEYS.handSets, JSON.stringify([{ id: 'p1', ownerToken: 'pack-secret', url: 'https://x/p/p1' }])],
    [EXTRA_KEYS.coachLinks, JSON.stringify({ links: [{ token: 'view', ownerToken: 'coach-secret', url: 'https://x/c/view' }], comments: {} })],
  ]);
  const text = JSON.stringify(out);
  for (const secret of ['edit-secret', 'pack-secret', 'coach-secret']) assert.ok(!text.includes(secret), secret);
  // What the links are stays: the id and the url of each, and the coach link's own view token.
  const extra = out.alsoOnThisPhone as { actionOffers: { o1: { lines: { remote: unknown }[] } }; handSets: unknown[]; coachLinks: { links: unknown[] } };
  assert.deepEqual(extra.actionOffers.o1.lines[0].remote, { id: 'r1', url: 'https://x/o/r1' });
  assert.deepEqual(extra.handSets[0], { id: 'p1', url: 'https://x/p/p1' });
  assert.deepEqual(extra.coachLinks.links[0], { token: 'view', url: 'https://x/c/view' });
  assert.doesNotThrow(() => parseBackup(JSON.stringify(out)));
});
