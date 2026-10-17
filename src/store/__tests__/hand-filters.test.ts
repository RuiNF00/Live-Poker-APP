/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sampleHand } from '../../poker/sample';
import type { Hand } from '../../poker/types';
import { activeFilters, gridCombo, handSearchText, heroPosition, matches, NO_FILTER, sortByResult } from '../hand-filters';

function hand(id: string, over: Partial<Hand> = {}, heroCards?: Hand['players'][number]['cards'], stack?: number): Hand {
  const h = sampleHand(id);
  const players = h.players.map((p, i) => (i === h.hero ? { ...p, ...(heroCards ? { cards: heroCards } : {}), ...(stack !== undefined ? { stack } : {}) } : p));
  return { ...h, ...over, players };
}

test('grid: pairs on the diagonal, suited above, offsuit below', () => {
  assert.equal(gridCombo(0, 0), 'AA');
  assert.equal(gridCombo(0, 1), 'AKs');
  assert.equal(gridCombo(1, 0), 'AKo');
  assert.equal(gridCombo(12, 12), '22');
  assert.equal(gridCombo(4, 12), 'T2s');
});

test('combos, position, stack band and game narrow the list', () => {
  const h = hand('a', {}, ['Ah', 'Kh']);
  assert.ok(matches(h, { ...NO_FILTER, combos: ['AKs'] }));
  assert.ok(!matches(h, { ...NO_FILTER, combos: ['AKo', 'QQ'] }));
  assert.ok(matches(h, { ...NO_FILTER, pos: [heroPosition(h)] }));
  assert.ok(!matches(h, { ...NO_FILTER, pos: ['__none'] }));
  const short = hand('b', {}, undefined, h.game.bb * 12);
  assert.ok(matches(short, { ...NO_FILTER, stack: 'short' }));
  assert.ok(!matches(short, { ...NO_FILTER, stack: 'deep' }));
  assert.ok(matches(h, { ...NO_FILTER, game: h.game.name.trim() }));
  assert.ok(!matches(h, { ...NO_FILTER, game: 'Outro' }));
  assert.equal(activeFilters({ ...NO_FILTER, pos: ['BTN'], combos: ['AA'], sort: 'won' }), 2);
});

test('sort by bb won or lost; hands without a result last', () => {
  const a = hand('a', { createdAt: 3 });
  const b = hand('b', { createdAt: 2 });
  const c = hand('c', { createdAt: 1 });
  const net: Record<string, number | undefined> = { a: 10 * a.game.bb, b: -40 * b.game.bb, c: undefined };
  assert.deepEqual(sortByResult([a, b, c], 'won', (h) => net[h.id]).map((h) => h.id), ['a', 'b', 'c']);
  assert.deepEqual(sortByResult([a, b, c], 'lost', (h) => net[h.id]).map((h) => h.id), ['b', 'a', 'c']);
});

test('search finds a hand by venue and by hero cards as a class or as dealt', () => {
  const h = hand('s', { game: { ...sampleHand('x').game, kind: 'cash', name: 'NLH 2/5', venue: 'Casino Estoril' } }, ['Ah', 'Kh']);
  const s = handSearchText(h);
  assert.ok(s.includes('estoril'));
  assert.ok(s.includes('aks'));
  assert.ok(s.includes('ahkh'));
  assert.ok(!s.includes('undefined'));
});
