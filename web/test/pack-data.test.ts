import { describe, expect, it } from 'vitest';
import { MAX_PACK_HANDS, parsePackHands } from '../src/lib/pack-data';

describe('parsePackHands', () => {
  it('keeps valid claims in order and drops duplicates', () => {
    const out = parsePackHands([
      { id: 'abc123', token: 'tok-12345678' },
      { id: 'zzz999', token: 'tok-87654321' },
      { id: 'abc123', token: 'tok-12345678' },
    ]);
    expect(out.map((h) => h.id)).toEqual(['abc123', 'zzz999']);
  });

  it('rejects bad ids and tokens', () => {
    expect(parsePackHands([{ id: '../x', token: 'tok-12345678' }, { id: 'abc123', token: 'short' }, { id: 'abc123' }, null, 'x'])).toEqual([]);
    expect(parsePackHands('nope')).toEqual([]);
  });

  it('caps the pack size', () => {
    const many = Array.from({ length: MAX_PACK_HANDS + 5 }, (_, i) => ({ id: `hand${i}`, token: 'tok-12345678' }));
    expect(parsePackHands(many)).toHaveLength(MAX_PACK_HANDS);
  });
});
