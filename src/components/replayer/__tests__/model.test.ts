/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { replay } from '@/poker/engine';
import { sampleHand } from '@/poker/sample';

import { timeline, viewAt } from '../model';

const opts = { inBB: false, reveal: false, atEnd: false };

test('heads-up against hidden cards: equity against the range villain raised with', () => {
  const hand = sampleHand('sample');
  const r = replay(hand);
  const k = r.steps.findIndex((s, i) => i > 0 && s.state.toAct === hand.hero && viewAt(hand, r, i, opts).facing && hand.players.filter((_, p) => !s.state.folded[p]).length === 2);
  assert.ok(k > 0, 'sample hand has hero facing a bet heads-up');
  const v = viewAt(hand, r, k, opts);
  assert.ok(v.rangeEq, 'shows equity vs range');
  assert.ok(v.rangeEq!.equity > 0 && v.rangeEq!.equity < 1);
  assert.ok([4, 8, 20, 40].includes(v.rangeEq!.pct));
});

test('no range equity while three or more are in the hand', () => {
  const hand = sampleHand('sample');
  const r = replay(hand);
  const k = r.steps.findIndex((s) => hand.players.filter((_, p) => !s.state.folded[p]).length >= 3);
  assert.equal(viewAt(hand, r, Math.max(k, 0), opts).rangeEq, null);
});

test('timeline: long names show the position, never a name cut mid-word', () => {
  const hand = sampleHand('sample');
  const items = timeline(hand, replay(hand), true).filter((it) => it.kind === 'action');
  for (const it of items) assert.ok(it.label.length <= 7 || hand.players.some((p) => p.name === it.label), it.label);
  const names = hand.players.map((p) => p.name).filter(Boolean) as string[];
  for (const it of items) assert.ok(!names.some((n) => n !== it.label && n.startsWith(it.label) && n.length > 7), `cut: ${it.label}`);
});

test('run it twice: both boards at the end, each winner tagged with their board', () => {
  // Folds to the button (hero, AA), who jams; the big blind (KK) calls. Board 1 holds, board 2 brings a king.
  const hand = {
    ...sampleHand('sample'),
    players: Array.from({ length: 6 }, (_, i) => ({ name: i ? '' : 'Hero', stack: 1000, cards: i === 0 ? ['As', 'Ad'] : i === 2 ? ['Kh', 'Kc'] : undefined })),
    button: 0,
    hero: 0,
    actions: [{ p: 3, kind: 'fold' as const }, { p: 4, kind: 'fold' as const }, { p: 5, kind: 'fold' as const }, { p: 0, kind: 'raise' as const, to: 1000 }, { p: 1, kind: 'fold' as const }, { p: 2, kind: 'call' as const }],
    board: ['2c', '7d', '9s', 'Jh', '3c'],
    board2: ['Ks', '4h', '8d', 'Qc', '5s'],
    winners: undefined,
  };
  hand.game = { ...hand.game, sb: 2, bb: 5, ante: 0, anteType: 'none', straddles: 0, bombPot: 0 };
  const r = replay(hand);
  const end = viewAt(hand, r, r.steps.length - 1, { ...opts, atEnd: true });
  assert.deepEqual(end.board2, ['Ks', '4h', '8d', 'Qc', '5s']);
  assert.equal(end.seats[0].run, 1);
  assert.equal(end.seats[2].run, 2);
  assert.match(end.narration, /^Board 1: Hero .*1001.* · Board 2: .*1001/);
  // Before the end only the first board shows.
  assert.equal(viewAt(hand, r, r.steps.length - 1, opts).board2, null);
});
