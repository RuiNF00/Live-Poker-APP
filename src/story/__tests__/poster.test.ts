/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sampleHand } from '../../poker/sample';
import { storyMoment } from '../moment';
import { posterLine } from '../poster';

test('the comment goes on the poster as written', () => {
  const hand = sampleHand('s');
  assert.equal(posterLine(hand, storyMoment(hand, 'question', false), '  Fold? '), 'Fold?');
});

test('a question asks, without the result', () => {
  const hand = sampleHand('s');
  assert.equal(posterLine(hand, storyMoment(hand, 'question', false), ''), 'O que fazes aqui?');
});

test('a result names the hand, never an amount or Ganhei/Perdi', () => {
  const hand = sampleHand('s');
  const m = storyMoment(hand, 'result', false);
  const line = posterLine(hand, m, '');
  assert.doesNotMatch(line, /\d|€|\$|Ganhei|Perdi/);
  assert.equal(line, m.replay.result?.handNames[hand.hero] ?? '');
});
