/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findPlayers, nameKey, sameName } from '../player-search';

const p = (id: string, name: string, extra: Partial<{ look: string; notes: string; tags: string[] }> = {}) => ({ id, name, look: '', notes: '', tags: [] as string[], ...extra });

test('nameKey: accents, case and spaces', () => {
  assert.equal(nameKey('  João   Silva '), 'joao silva');
  assert.equal(nameKey('JOÃO silva'), nameKey('joao Silva'));
});

test('findPlayers: accents, word order, tags shown translated, names first', () => {
  const list = [p('a', 'Rui', { notes: 'joga com o João' }), p('b', 'João Boné', { look: 'boné azul' }), p('c', 'Ana', { tags: ['Agressivo'] })];
  assert.deepEqual(findPlayers(list, 'joao').map((x) => x.id), ['b', 'a']);
  assert.deepEqual(findPlayers(list, 'azul bone').map((x) => x.id), ['b']);
  assert.deepEqual(findPlayers(list, 'aggressive', (x) => (x === 'Agressivo' ? 'Aggressive' : x)).map((x) => x.id), ['c']);
  assert.deepEqual(findPlayers(list, '  ').map((x) => x.id), ['a', 'b', 'c']);
  assert.deepEqual(findPlayers(list, 'ninguem'), []);
});

test('sameName: another note, same name once normalised', () => {
  const list = [p('a', 'Boné Azul'), p('b', 'Ana')];
  assert.equal(sameName(list, { id: 'new', name: ' bone azul' })?.id, 'a');
  assert.equal(sameName(list, { id: 'a', name: 'Boné Azul' }), undefined);
  assert.equal(sameName(list, { id: 'new', name: '' }), undefined);
});
