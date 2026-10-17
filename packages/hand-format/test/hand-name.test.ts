import { describe, expect, it } from 'vitest';
import { bestHand, handName, type Card, type HandNameLocale } from '../src';

// Hole cards + board → the made hand as players say it at the table.
const name = (hole: string[], board: string[], l: HandNameLocale = 'pt') => handName(bestHand(hole as Card[], board as Card[])!.score, l);
const B = ['2c', '7d', '9s', 'Jh', '3c'];

describe('hand names, precise, in the four languages', () => {
  const cases: [string, string[], string[], Record<HandNameLocale, string>][] = [
    ['high card', ['Ah', '4d'], B, { pt: 'Carta alta: Ás', 'pt-BR': 'Carta alta: Ás', es: 'Carta alta: As', en: 'Ace high' }],
    ['pair of aces', ['As', 'Ad'], B, { pt: 'Par de Ases', 'pt-BR': 'Par de Ases', es: 'Pareja de Ases', en: 'Pair of Aces' }],
    ['pair of eights', ['8s', '8d'], B, { pt: 'Par de 8', 'pt-BR': 'Par de 8', es: 'Pareja de 8', en: 'Pair of 8s' }],
    ['two pair', ['Kd', '7s'], ['Kc', '7h', '2d', '9c', '3s'], { pt: 'Dois pares, Reis e 7', 'pt-BR': 'Dois pares, Reis e 7', es: 'Doble pareja, Reyes y 7', en: 'Two pair, Kings and 7s' }],
    ['trips', ['8s', '8d'], ['8c', 'Kh', '2d', '9c', '3s'], { pt: 'Trio de 8', 'pt-BR': 'Trinca de 8', es: 'Trío de 8', en: 'Three of a kind, 8s' }],
    ['ace-high straight', ['Ah', 'Kd'], ['Qc', 'Js', 'Th', '2d', '3c'], { pt: 'Sequência ao Ás', 'pt-BR': 'Sequência até o Ás', es: 'Escalera al As', en: 'Straight, Ace high' }],
    ['queen-high straight', ['Qh', 'Jd'], ['Tc', '9s', '8h', '2d', '3c'], { pt: 'Sequência à Dama', 'pt-BR': 'Sequência até a Dama', es: 'Escalera a la Reina', en: 'Straight, Queen high' }],
    ['wheel', ['Ah', '2d'], ['3c', '4s', '5h', 'Kd', 'Kc'], { pt: 'Sequência ao 5', 'pt-BR': 'Sequência até o 5', es: 'Escalera al 5', en: 'Straight, 5 high' }],
    ['flush', ['Ah', '4h'], ['Kh', '9h', '2h', '7c', '3s'], { pt: 'Cor', 'pt-BR': 'Flush', es: 'Color', en: 'Flush' }],
    ['full house', ['Qs', 'Qd'], ['Qc', '4h', '4d', '9c', '3s'], { pt: 'Full: Damas e 4', 'pt-BR': 'Full house: Damas e 4', es: 'Full de Reinas y 4', en: 'Full house, Queens full of 4s' }],
    ['quads', ['Ks', 'Kd'], ['Kc', 'Kh', '4d', '9c', '3s'], { pt: 'Poker de Reis', 'pt-BR': 'Quadra de Reis', es: 'Póker de Reyes', en: 'Four of a kind, Kings' }],
    ['straight flush', ['9h', 'Th'], ['Jh', 'Qh', 'Kh', '2c', '3d'], { pt: 'Sequência de cor ao Rei', 'pt-BR': 'Straight flush até o Rei', es: 'Escalera de color al Rey', en: 'Straight flush, King high' }],
    ['royal flush', ['Ah', 'Th'], ['Jh', 'Qh', 'Kh', '2c', '3d'], { pt: 'Royal flush', 'pt-BR': 'Royal flush', es: 'Escalera real', en: 'Royal flush' }],
  ];
  for (const [what, hole, board, want] of cases)
    it(what, () => {
      for (const l of Object.keys(want) as HandNameLocale[]) expect(name(hole, board, l)).toBe(want[l]);
    });

  it('no name below five cards', () => {
    expect(handName(-1)).toBe('');
  });
});
