import { describe, expect, it } from 'vitest';
import { parseEntry, parseName, parseTerms, swapBalance } from '../src/lib/swap-terms';

const base = {
  v: 1, scope: 'series', title: 'WSOP Paradise 2026', venue: 'Atlantis', currency: '$',
  a: { name: 'Rui', pct: 5 }, b: { name: 'João', pct: 5 }, note: 'Só eventos até $25k', createdAt: 1_790_000_000_000,
};

describe('parseTerms', () => {
  it('keeps valid terms as they are', () => {
    expect(parseTerms(base)).toEqual(base);
  });
  it('drops unknown fields and cuts strings', () => {
    const t = parseTerms({ ...base, tokens: 'x', title: 'x'.repeat(200) });
    expect(t).not.toHaveProperty('tokens');
    expect(t && t !== 'offensive' && t.title.length).toBe(80);
  });
  it('refuses missing names, a bad scope and percentages out of range', () => {
    expect(parseTerms({ ...base, a: { name: '', pct: 5 } })).toBeNull();
    expect(parseTerms({ ...base, scope: 'forever' })).toBeNull();
    expect(parseTerms({ ...base, b: { name: 'João', pct: 80 } })).toBeNull();
    expect(parseTerms({ ...base, b: { name: 'João', pct: 0 } })).toBeNull();
    expect(parseTerms({ ...base, v: 2 })).toBeNull();
  });
  it('rounds percentages to one decimal', () => {
    const t = parseTerms({ ...base, a: { name: 'Rui', pct: 2.55 } });
    expect(t && t !== 'offensive' && t.a.pct).toBe(2.6);
  });
  it('flags offensive names', () => {
    expect(parseTerms({ ...base, b: { name: 'fuck', pct: 5 } })).toBe('offensive');
  });
});

describe('parseEntry', () => {
  it('accepts a prize, including a bust at 0', () => {
    expect(parseEntry({ cid: 'c1', kind: 'result', amount: 125000.555, event: 'Main Event', finish: 7 })).toEqual({ cid: 'c1', kind: 'result', amount: 125000.56, event: 'Main Event', finish: 7 });
    expect(parseEntry({ cid: 'c1', kind: 'result', amount: 0 })).not.toBeNull();
  });
  it('refuses a payment of 0, negatives and entries without a client id', () => {
    expect(parseEntry({ cid: 'c1', kind: 'payment', amount: 0 })).toBeNull();
    expect(parseEntry({ cid: 'c1', kind: 'result', amount: -5 })).toBeNull();
    expect(parseEntry({ kind: 'result', amount: 5 })).toBeNull();
  });
  it('never takes the side, id or time from the client', () => {
    const e = parseEntry({ cid: 'c1', kind: 'payment', amount: 10, side: 'b', id: 'x', at: 1 });
    expect(e).not.toHaveProperty('side');
    expect(e).not.toHaveProperty('id');
    expect(e).not.toHaveProperty('at');
  });
});

describe('parseName', () => {
  it('trims and checks', () => {
    expect(parseName('  João  ')).toBe('João');
    expect(parseName('')).toBeNull();
    expect(parseName('cunt')).toBe('offensive');
  });
});

describe('swapBalance', () => {
  const terms = { a: { name: 'Rui', pct: 5 }, b: { name: 'João', pct: 3 } };
  it('nets both sides: positive means b owes a', () => {
    const b = swapBalance(terms, [
      { side: 'b', kind: 'result', amount: 100000 }, // João owes 3,000
      { side: 'a', kind: 'result', amount: 20000 }, // Rui owes 1,000
    ]);
    expect(b).toEqual({ aOwes: 1000, bOwes: 3000, aPaid: 0, bPaid: 0, net: 2000 });
  });
  it('payments settle it', () => {
    const b = swapBalance(terms, [
      { side: 'b', kind: 'result', amount: 100000 },
      { side: 'a', kind: 'result', amount: 20000 },
      { side: 'b', kind: 'payment', amount: 2000 },
    ]);
    expect(b.net).toBe(0);
  });
  it('a overpaying turns it around', () => {
    const b = swapBalance(terms, [
      { side: 'a', kind: 'result', amount: 20000 },
      { side: 'a', kind: 'payment', amount: 1500 },
    ]);
    expect(b.net).toBe(500);
  });
});

describe('received (the creditor marks what the other side paid)', () => {
  const terms = { a: { name: 'Rui', pct: 10 }, b: { name: 'Tiago', pct: 10 } };
  it('parses like a payment', () => {
    expect(parseEntry({ cid: 'r1', kind: 'received', amount: 120.456 })).toEqual({ cid: 'r1', kind: 'received', event: '', amount: 120.46, finish: null });
    expect(parseEntry({ cid: 'r1', kind: 'received', amount: 0 })).toBeNull();
  });
  it('counts as paid by the other side', () => {
    // Tiago won 1000 (owes Rui 100); Rui records he got 60 of it.
    const b = swapBalance(terms, [
      { side: 'b', kind: 'result', amount: 1000 },
      { side: 'a', kind: 'received', amount: 60 },
    ]);
    expect(b).toMatchObject({ bOwes: 100, bPaid: 60, aPaid: 0, net: 40 });
    const done = swapBalance(terms, [
      { side: 'b', kind: 'result', amount: 1000 },
      { side: 'a', kind: 'received', amount: 60 },
      { side: 'b', kind: 'payment', amount: 40 },
    ]);
    expect(done.net).toBe(0);
  });
});

describe('rounding (same as the app)', () => {
  it('rounds each prize share to the cent, so a settled swap is 0,00 on both', () => {
    const terms = { a: { name: 'Eva', pct: 7.5 }, b: { name: 'Ana', pct: 7.5 } };
    // Two prizes of 1234,50 at 7,5%: 92,59 + 92,59 = 185,18 (not 185,175 → 185,17).
    const b = swapBalance(terms, [
      { side: 'a', kind: 'result', amount: 1234.5 },
      { side: 'a', kind: 'result', amount: 1234.5 },
    ]);
    expect(b.aOwes).toBe(185.18);
    expect(swapBalance(terms, [
      { side: 'a', kind: 'result', amount: 1234.5 },
      { side: 'a', kind: 'result', amount: 1234.5 },
      { side: 'a', kind: 'payment', amount: 185.18 },
    ]).net).toBe(0);
  });
});
