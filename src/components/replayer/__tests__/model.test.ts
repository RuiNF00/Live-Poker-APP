/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { replay } from '@/poker/engine';
import { sampleHand } from '@/poker/sample';

import { viewAt } from '../model';

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
