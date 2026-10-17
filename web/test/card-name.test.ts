import { describe, expect, it } from 'vitest';
import { cardLabel, hiddenCardLabel } from '../src/lib/card-name';

describe('spoken card names on the web pages', () => {
  it('reads the card in the page language', () => {
    expect(cardLabel('Ks', 'pt')).toBe('Rei de espadas');
    expect(cardLabel('Ks', 'pt-BR')).toBe('Rei de espadas');
    expect(cardLabel('Th', 'en')).toBe('Ten of hearts');
    expect(cardLabel('Ac', 'es')).toBe('As de tréboles');
    expect(hiddenCardLabel('en')).toBe('face-down card');
    expect(hiddenCardLabel('pt-BR')).toBe('carta fechada');
  });
});
