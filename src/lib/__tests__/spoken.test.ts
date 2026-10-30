/// <reference types="node" />
// What VoiceOver and TalkBack say after a save, and the time played: words, not a clock read
// digit by digit, in the three languages.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { translate } from '../../i18n';
import { savedMessage, spokenPlayed } from '../spoken';

test('a saved hand or session says so, then the result', () => {
  assert.equal(savedMessage('hand', '+3'), 'Mão guardada. Resultado: +3');
  assert.equal(savedMessage('session', '−120 €'), 'Sessão guardada. Resultado: −120 €');
  // A hand saved before its end has no result yet: only that it was saved.
  assert.equal(savedMessage('hand'), 'Mão guardada');
  assert.equal(translate('pt-BR', 'Mão guardada'), 'Mão salva');
  assert.equal(translate('es', 'Sessão guardada'), 'Sesión guardada');
});

test('time played in hours and minutes, never seconds', () => {
  assert.equal(spokenPlayed(0), '0 min');
  assert.equal(spokenPlayed(59_999), '0 min');
  assert.equal(spokenPlayed(45 * 60_000 + 30_000), '45 min');
  assert.equal(spokenPlayed(65 * 60_000 + 32_000), '1 h 05 min');
  assert.equal(spokenPlayed(10 * 3_600_000), '10 h 00 min');
  assert.equal(spokenPlayed(-5), '0 min');
});
