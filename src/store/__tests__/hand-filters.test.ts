/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sampleHand } from '../../poker/sample';
import type { Hand } from '../../poker/types';
import { activeFilters, comboSet, gridCombo, handSearchText, heroPosition, matches, matchesSearch, NO_FILTER, parseSearch, sortByResult } from '../hand-filters';

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

test('cards as players write them: AK, AKs, QQ+, ATs+', () => {
  const list = (w: string) => [...(comboSet(w) ?? [])].sort();
  assert.deepEqual(list('AK'), ['AKo', 'AKs']);
  assert.deepEqual(list('ka'), ['AKo', 'AKs']);
  assert.deepEqual(list('AKs'), ['AKs']);
  assert.deepEqual(list('QQ+'), ['AA', 'KK', 'QQ']);
  assert.deepEqual(list('ATs+'), ['AJs', 'AKs', 'AQs', 'ATs']);
  assert.deepEqual(list('tt'), ['TT']);
  assert.equal(comboSet('lisboa'), null);
  assert.equal(comboSet('QQs'), null);
  assert.equal(comboSet('bb'), null);
});

test('search: every word must match, cards and position read as such', () => {
  const ak = hand('ak', { game: { ...sampleHand('x').game, name: 'Main Event Dia 1' } }, ['Ah', 'Kd']);
  const qq = hand('qq', {}, ['Qh', 'Qd']);
  const text = (h: Hand) => handSearchText(h) + ' casino lisboa';
  const find = (q: string) => [ak, qq].filter((h) => matchesSearch(h, parseSearch(q), text(h))).map((h) => h.id);
  assert.deepEqual(find('AK lisboa'), ['ak']);
  assert.deepEqual(find('ak dia 1'), ['ak']);
  assert.deepEqual(find('QQ+'), ['qq']);
  assert.deepEqual(find('AK QQ'), []);
  assert.deepEqual(find(`qq ${heroPosition(qq).toLowerCase()}`), ['qq']);
  assert.deepEqual(find('porto'), []);
});

test('result and session filters; won and lost keep the newest first', () => {
  const nets: Record<string, number> = { a: 50, b: -30, c: 0 };
  const list = ['a', 'b', 'c'].map((id) => hand(id, { sessionId: id === 'c' ? 's2' : 's1' }));
  const net = (h: Hand) => nets[h.id];
  assert.deepEqual(list.filter((h) => matches(h, { ...NO_FILTER, result: 'won' }, net)).map((h) => h.id), ['a']);
  assert.deepEqual(list.filter((h) => matches(h, { ...NO_FILTER, result: 'lost' }, net)).map((h) => h.id), ['b']);
  assert.deepEqual(list.filter((h) => matches(h, { ...NO_FILTER, session: 's2' })).map((h) => h.id), ['c']);
  assert.equal(activeFilters({ ...NO_FILTER, result: 'lost', session: 's1' }), 2);
});

test('500 hands: the two lookups land on the hand at the top of the list', () => {
  // Hero's hands cycle through 25 holdings over 5 sessions; newest first, as the list shows them.
  const holdings: Hand['players'][number]['cards'][] = [['Ah', 'Kd'], ['Qh', 'Qd'], ['Kh', 'Kd'], ['7h', '2d'], ['Jh', 'Td'], ...Array.from({ length: 20 }, () => ['9h', '4d'] as Hand['players'][number]['cards'])];
  const all = Array.from({ length: 500 }, (_, i) => hand(`h${i}`, { createdAt: 500 - i, sessionId: `s${i % 5}` }, holdings[i % 25]));
  const net = (h: Hand) => (Number(h.id.slice(1)) % 3 === 0 ? -40 : 25);
  const sessionText: Record<string, string> = { s0: ' main event dia 1 casino lisboa', s1: ' cash porto', s2: ' dia 2', s3: '', s4: '' };
  const run = (q: string, f = NO_FILTER) => all.filter((h) => matchesSearch(h, parseSearch(q), handSearchText(h) + sessionText[h.sessionId!]) && matches(h, f, net));
  // "A mão de AK no Dia 1 de Lisboa": session chip + AK chip.
  const ak = run('AK', { ...NO_FILTER, session: 's0' });
  assert.equal(ak[0].id, 'h0');
  assert.ok(ak.every((h) => h.sessionId === 's0'));
  // The same by typing: "ak lisboa".
  assert.deepEqual(run('ak lisboa').map((h) => h.id), ak.map((h) => h.id));
  // "A última mão que perdi com um par alto": Perdi chip + QQ+ chip.
  const lost = run('QQ+', { ...NO_FILTER, result: 'lost' });
  assert.equal(lost[0].id, all.find((h) => ['QQ', 'KK', 'AA'].includes(h.players[h.hero].cards!.map((c) => c[0]).join('')) && net(h) < 0)!.id);
});
