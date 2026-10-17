/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { forumText } from '../text';
import type { Hand } from '../types';

function mk(over: Partial<Hand> = {}): Hand {
  return {
    v: 1, id: 't', createdAt: 0, updatedAt: 0,
    game: { kind: 'cash', name: 'Casino Lisboa', sb: 1, bb: 2, ante: 0, anteType: 'none', currency: '€' },
    players: [
      { name: 'Rui', stack: 200, cards: ['As', 'Kd'] },
      { name: 'Zé', stack: 135 },
      { name: 'Ana', stack: 400, cards: ['Qs', 'Jh'] },
      { name: 'V3', stack: 200 },
      { name: 'V4', stack: 200 },
      { name: 'V5', stack: 200 },
    ],
    button: 0, hero: 0, actions: [], board: [], tags: [], notes: 'Too thin?',
    ...over,
  };
}

test('standard layout: seats in bb, folds collapsed, pot per street, showdown and result', () => {
  const h = mk({
    actions: [
      { p: 3, kind: 'fold' }, { p: 4, kind: 'fold' }, { p: 5, kind: 'fold' },
      { p: 0, kind: 'raise', to: 5 }, { p: 1, kind: 'fold' }, { p: 2, kind: 'call' },
      { p: 2, kind: 'check' }, { p: 0, kind: 'bet', to: 4 }, { p: 2, kind: 'call' },
      { p: 2, kind: 'check' }, { p: 0, kind: 'check' },
      { p: 2, kind: 'check' }, { p: 0, kind: 'bet', to: 15 }, { p: 2, kind: 'call' },
    ],
    board: ['Qd', '8h', '3h', '2c', 'Kc'],
  });
  const txt = forumText(h);
  assert.equal(
    txt,
    [
      "NL Hold'em · Cash · Casino Lisboa · 1/2 · 6-handed",
      '',
      'UTG: 100 bb',
      'HJ: 100 bb',
      'CO: 100 bb',
      'BTN (Hero): 100 bb',
      'SB: 67.5 bb',
      'BB: 200 bb',
      '',
      'Hero is BTN with As Kd',
      '',
      'Preflop (1.5 bb)',
      '3 folds, Hero raises to 2.5 bb, SB folds, BB calls 1.5 bb',
      '',
      'Flop (5.5 bb): Qd 8h 3h',
      'BB checks, Hero bets 2 bb, BB calls 2 bb',
      '',
      'Turn (9.5 bb): 2c',
      'BB checks, Hero checks',
      '',
      'River (9.5 bb): Kc',
      'BB checks, Hero bets 7.5 bb, BB calls 7.5 bb',
      '',
      'BB shows Qs Jh',
      'Hero wins 24.5 bb',
    ].join('\n'),
  );
  // Opponents' names never leave the phone.
  assert.ok(!/Zé|Ana|Rui/.test(txt));
});

test('free plan line, replay link and notes are opt-in', () => {
  const h = mk({ actions: [{ p: 3, kind: 'raise', to: 6 }, { p: 4, kind: 'fold' }, { p: 5, kind: 'fold' }, { p: 0, kind: 'fold' }, { p: 1, kind: 'fold' }, { p: 2, kind: 'fold' }] });
  const plain = forumText(h);
  assert.ok(!plain.includes('Sweatbook') && !plain.includes('Too thin'));
  assert.ok(plain.endsWith('UTG wins 2.5 bb'), plain);
  const txt = forumText(h, { link: 'https://sweatbook.poker/h/abc', brand: true, notes: true });
  assert.ok(txt.endsWith('Too thin?\n\nReplay: https://sweatbook.poker/h/abc\nShared with Sweatbook · sweatbook.poker'), txt);
});

test('tournament header and all-in run-out', () => {
  const h = mk({
    game: { kind: 'mtt', name: 'Main Event', sb: 1000, bb: 2000, ante: 2000, anteType: 'bb', currency: '$', level: 12, stage: 'bubble', playersLeft: 87 },
    players: [
      { name: 'Hero', stack: 40000, cards: ['Ah', 'Ad'] },
      { name: '', stack: 100000, cards: ['Kc', 'Ks'] },
    ],
    button: 0,
    actions: [{ p: 0, kind: 'raise', to: 40000 }, { p: 1, kind: 'call' }],
    board: ['2c', '7d', '9s', 'Th', '3c'],
  });
  const txt = forumText(h);
  assert.match(txt.split('\n')[0], /^NL Hold'em · Tournament · Main Event · 1000\/2000 \(2000 BB ante\) · Level 12 · Bubble · 87 left · 2-handed$/);
  assert.ok(txt.includes('Hero raises to 20 bb all-in, BB calls 19 bb'), txt);
  assert.ok(txt.includes('Flop (41 bb): 2c 7d 9s'), txt);
  assert.ok(txt.includes('River (41 bb): 3c'), txt);
  assert.ok(txt.includes('BB shows Kc Ks\nHero wins 41 bb'), txt);
});

test('live extras: straddles, button ante and bomb pots show in the header', () => {
  const g = mk().game;
  const str = forumText(mk({ game: { ...g, straddles: 2, straddleFrom: 'utg', ante: 2, anteType: 'btn' } }));
  assert.equal(str.split('\n')[0], "NL Hold'em · Cash · Casino Lisboa · 1/2 (2 button ante) · UTG straddle 4, HJ re-straddle 8 · 6-handed");
  assert.ok(str.includes('Preflop (8.5 bb)'), str);
  const btn = forumText(mk({ game: { ...g, straddles: 1, straddleFrom: 'btn' } }));
  assert.ok(btn.split('\n')[0].includes('BTN (Hero) straddle 4'), btn);
  const bomb = forumText(mk({ game: { ...g, bombPot: 10 }, board: ['Qd', '8h', '3h'], actions: [{ p: 1, kind: 'check' }] }));
  assert.ok(bomb.split('\n')[0].includes('Bomb pot: 5 bb each, starts on the flop'), bomb);
  assert.ok(!bomb.includes('Preflop'), bomb);
  assert.ok(bomb.includes('Flop (30 bb): Qd 8h 3h\nSB checks'), bomb);
});

test('run it twice: each board with the half it paid', () => {
  const h = mk({
    players: [
      { name: 'Rui', stack: 1000, cards: ['As', 'Ad'] },
      { name: '', stack: 1000 },
      { name: '', stack: 1000, cards: ['Kh', 'Kc'] },
      { name: '', stack: 1000 }, { name: '', stack: 1000 }, { name: '', stack: 1000 },
    ],
    actions: [{ p: 3, kind: 'fold' }, { p: 4, kind: 'fold' }, { p: 5, kind: 'fold' }, { p: 0, kind: 'raise', to: 1000 }, { p: 1, kind: 'fold' }, { p: 2, kind: 'call' }],
    board: ['2c', '7d', '9s', 'Jh', '3c'],
    board2: ['Ks', '4h', '8d', 'Qc', '5s'],
  });
  const txt = forumText(h);
  assert.ok(txt.endsWith('BB shows Kh Kc\nRun it twice\n1st run: 2c 7d 9s Jh 3c · Hero wins 500.5 bb\n2nd run: Ks 4h 8d Qc 5s · BB wins 500 bb'), txt);
});

test('a cash hand never shows a tournament level left over from the defaults', () => {
  const h = mk();
  h.game = { ...h.game, level: 1, stage: 'early', playersLeft: 58 };
  const head = forumText(h).split('\n')[0];
  assert.doesNotMatch(head, /Level|left|Early/);
});
