import { describe, expect, it } from 'vitest';
import { handleProblem, normalizeHandle, parseHandClaims, parseProfile } from '../src/lib/profile-data';

const session = { id: 's1', kind: 'mtt', name: 'EPT Barcelona', venue: 'Casino Barcelona', date: 1760000000000, hours: 9, currency: '€', buyIn: 5300, result: 21000, finish: 12, field: 1800 };

describe('public profile', () => {
  it('hides amounts unless the player turned that off', () => {
    const p = parseProfile({ name: 'Ana', sessions: [session] });
    expect(p).not.toBe('offensive');
    const s = (p as Exclude<typeof p, 'offensive' | null>).sessions[0];
    expect(s.buyIn).toBeUndefined();
    expect(s.result).toBeUndefined();
    expect(s.finish).toBe(12);
    const shown = parseProfile({ name: 'Ana', hideAmounts: false, sessions: [session] });
    expect((shown as Exclude<typeof shown, 'offensive' | null>).sessions[0].result).toBe(21000);
  });

  it('drops unknown fields and bad sessions', () => {
    const p = parseProfile({ name: 'Ana', email: 'x@y.z', sessions: [{ ...session, kind: 'spin' }, { ...session, date: 'ontem' }] });
    expect(p).toMatchObject({ v: 1, name: 'Ana', sessions: [] });
    expect(p).not.toHaveProperty('email');
    expect(parseProfile('nope')).toBeNull();
  });

  it('checks handles', () => {
    expect(normalizeHandle(' @RuiF ')).toBe('ruif');
    expect(handleProblem('ruif')).toBeNull();
    expect(handleProblem('ab')).toBe('invalid');
    expect(handleProblem('a..b')).toBe('invalid');
    expect(handleProblem('_ruif')).toBe('invalid');
    expect(handleProblem('admin')).toBe('reserved');
    expect(handleProblem('sweat_book')).toBe('reserved');
  });

  it('keeps hand claims in share-id shape, once each', () => {
    const c = parseHandClaims([{ id: 'abc123', token: 't' }, { id: 'abc123', token: 't2' }, { id: '../x', token: 't' }, { id: 'ok1', token: 5 }]);
    expect(c).toEqual([{ id: 'abc123', token: 't' }]);
  });
});
