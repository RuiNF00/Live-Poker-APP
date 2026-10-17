/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { handShareText } from '../share-text';

test('hand share text: game, colon, question; never a contest', () => {
  assert.equal(handShareText('NLH 2/5', 'link'), 'NLH 2/5: o que fazias aqui? 👀');
  assert.equal(handShareText('  ', 'link'), 'O que fazias aqui? 👀');
  const quiz = handShareText('NLH 2/5', 'challenge');
  assert.ok(quiz.startsWith('NLH 2/5: o que fazes aqui?'));
  assert.ok(!/desafio|—/.test(quiz));
  assert.ok(handShareText(undefined, 'video').includes('no link'));
});
