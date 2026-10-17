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
  it('blocks the common pt-BR and Spanish ones too', () => {
    expect(isOffensive('vai tomar no cu')).toBe(true);
    expect(isOffensive('que arrombado')).toBe(true);
    expect(isOffensive('eres un gilipollas')).toBe(true);
    expect(isOffensive('MARICÓN')).toBe(true);
    expect(isOffensive('pendej0')).toBe(true);
    expect(isOffensive('Cabrón, qué river')).toBe(true);
  });
  it('lets normal pt-BR and Spanish poker talk through', () => {
    expect(isOffensive('Você deu call no river com par de damas? Eu foldava.')).toBe(false);
    expect(isOffensive('El torneo va retrasado, jugué el bote con proyecto de color')).toBe(false);
  });
});
