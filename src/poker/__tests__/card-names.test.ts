/// <reference types="node" />
// Screen readers read every card of the picker by name.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cardName, FULL_DECK } from '../cards';

test('every card has a spoken name, all different', () => {
  assert.equal(cardName('Ah'), 'Ás de copas');
  assert.equal(cardName('Td'), 'Dez de ouros');
  assert.equal(cardName('2c'), 'Dois de paus');
  assert.equal(new Set(FULL_DECK.map(cardName)).size, 52);
});
