import { describe, expect, it } from 'vitest';
import { isOffensive } from '../src/lib/moderation';

describe('isOffensive', () => {
  it('blocks common insults, with accents and leetspeak', () => {
    expect(isOffensive('és um filho da puta')).toBe(true);
    expect(isOffensive('CABRÃO')).toBe(true);
    expect(isOffensive('f0da-se isto')).toBe(true);
    expect(isOffensive('what a fucking call')).toBe(true);
  });
  it('lets normal poker talk through', () => {
    expect(isOffensive('Shove no turn é demasiado, prefiro call e fold ao river')).toBe(false);
    expect(isOffensive('computador diz fold')).toBe(false);
    expect(isOffensive('Disputa boa, reputação de nit')).toBe(false);
  });
});
