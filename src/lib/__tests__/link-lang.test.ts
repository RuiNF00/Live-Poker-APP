import assert from 'node:assert/strict';
import { test } from 'node:test';

import { withLang } from '../link-lang';

test('adds the language to a bare link and to one with a query', () => {
  assert.equal(withLang('https://sweatbook.poker/h/abc', 'pt-PT'), 'https://sweatbook.poker/h/abc?lang=pt-PT');
  assert.equal(withLang('https://sweatbook.poker/swap/x?r=RUI', 'pt-BR'), 'https://sweatbook.poker/swap/x?r=RUI&lang=pt-BR');
});

test('keeps a #fragment last', () => {
  assert.equal(withLang('https://sweatbook.poker/swap/g/x?r=RUI#i=sec', 'es'), 'https://sweatbook.poker/swap/g/x?r=RUI&lang=es#i=sec');
});
