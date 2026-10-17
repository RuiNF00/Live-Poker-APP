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
  // H: the hand screen invites comments street by street.
  assert.equal(handShareText('NLH 2/5', 'comment'), 'NLH 2/5: diz-me o que fazias, rua a rua. Comenta na própria mão 👀');
  assert.ok(handShareText('', 'comment').startsWith('Diz-me'));
});
