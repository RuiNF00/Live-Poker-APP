/// <reference types="node" />
// Screen readers read every card of the picker by name.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { spokenCard, spokenStreet } from '@/components/replayer/model';
import { translate, VARIANTS } from '@/i18n';

import { cardName as pickerName, handClassName } from '../card-name';
import { cardName, FULL_DECK, RANKS } from '../cards';

test('every card has a spoken name, all different', () => {
  assert.equal(cardName('Ah'), 'Ás de copas');
  assert.equal(cardName('Td'), 'Dez de ouros');
  assert.equal(cardName('2c'), 'Dois de paus');
  assert.equal(new Set(FULL_DECK.map(cardName)).size, 52);
});

test('every rank is a word, never a digit or "T", in the picker, the replayer and the range sheet', () => {
  for (const c of FULL_DECK) {
    assert.doesNotMatch(cardName(c), /\d|^T /, c);
    assert.equal(spokenCard(c), cardName(c), `replayer reads ${c} like the picker`);
    assert.equal(pickerName(c), cardName(c));
  }
  assert.equal(spokenCard('Th'), 'Dez de copas');
  assert.equal(spokenCard('7c'), 'Sete de paus');
  assert.equal(spokenStreet('flop', ['Ah', 'Ts', '7d']), 'Flop: Ás de copas, Dez de espadas, Sete de ouros');
  assert.equal(handClassName('T9s'), 'Dez e Nove, mesmo naipe');
});

// The words each language's screen reader gets for the rank and suit keys cardName uses.
const RANK_KEY = ['Ás', 'Rei', 'Dama', 'Valete', 'Dez', 'Nove', 'Oito', 'Sete', 'Seis', 'Cinco', 'Quatro', 'Três', 'Dois'];
const SUIT_KEY = ['espadas', 'copas', 'ouros', 'paus'];

test('each language reads the ranks as words', () => {
  assert.equal(RANK_KEY.length, RANKS.length);
  const expect: Record<string, string[]> = {
    'pt-PT': RANK_KEY,
    'pt-BR': RANK_KEY,
    en: ['Ace', 'King', 'Queen', 'Jack', 'Ten', 'Nine', 'Eight', 'Seven', 'Six', 'Five', 'Four', 'Three', 'Two'],
    es: ['As', 'Rey', 'Reina', 'Jota', 'Diez', 'Nueve', 'Ocho', 'Siete', 'Seis', 'Cinco', 'Cuatro', 'Tres', 'Dos'],
  };
  for (const v of VARIANTS) {
    const words = RANK_KEY.map((k) => translate(v, k));
    assert.deepEqual(words, expect[v], v);
    for (const w of words) assert.doesNotMatch(w, /\d/, `${v}: ${w}`);
    const suits = SUIT_KEY.map((k) => translate(v, k));
    assert.equal(new Set(suits).size, 4, v);
    assert.match(translate(v, '{rank} de {suit}'), /\{rank\}.*\{suit\}/, v);
  }
  assert.equal(translate('en', '{rank} de {suit}'), '{rank} of {suit}');
  assert.deepEqual(SUIT_KEY.map((k) => translate('es', k)), ['picas', 'corazones', 'diamantes', 'tréboles']);
});
