/// <reference types="node" />
// Every example in «Como ditar uma mão» must come out right when tried: the help never shows
// a sentence the app can't read.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { positions, replay } from '../../../poker/engine';
import { base, line } from '../../../poker/__tests__/voice-cases';
import { handFromSpeech } from '../../../poker/voice';
import { dictationLang, EXAMPLES } from '../dictation-examples';

test('each help example is read in full: position, cards, a valid line, no warning', () => {
  for (const [lang, list] of Object.entries(EXAMPLES)) {
    assert.ok(list.length >= 5 && list.length <= 6, lang);
    for (const text of list) {
      const r = handFromSpeech(text, base());
      const h = r.hand;
      assert.ok(r.posKnown, `${lang}: ${text}`);
      assert.equal(h.players[h.hero].cards?.length, 2, `${lang}: ${text}`);
      assert.ok(line(h).length > 0, `${lang}: ${text}`);
      assert.equal(replay(h).invalidAt, null, `${lang}: ${text}`);
      const bad = r.notes.map((n) => n.code).filter((c) => c !== 'suits');
      assert.deepEqual(bad, [], `${lang}: ${text} → ${positions(h.players.length, h.button)[h.hero]} ${line(h)}`);
    }
  }
});

test('Spanish outside Spain gets the Mexican examples', () => {
  assert.equal(dictationLang('es', 'es-ES'), 'es');
  assert.equal(dictationLang('es', 'es'), 'es');
  assert.equal(dictationLang('es', 'es-MX'), 'es-MX');
  assert.equal(dictationLang('es', 'es-US'), 'es-MX');
  assert.equal(dictationLang('pt-BR', 'pt-BR'), 'pt-BR');
  assert.equal(dictationLang('pt-PT', 'pt-PT'), 'pt-PT');
  assert.equal(dictationLang('en', 'en-GB'), 'en');
});

test('no store-banned words in the examples (they show on screen): poker «bet» only', () => {
  for (const [lang, list] of Object.entries(EXAMPLES)) for (const text of list) assert.doesNotMatch(text, /\bapost|\bapuest|\bbetting\b/i, `${lang}: ${text}`);
});
