import { describe, expect, it } from 'vitest';
import { groupNet, minTransfers, parseGroup, parseGroupEntry } from '../src/lib/swap-group-terms';

const terms = { v: 1, scope: 'series', title: 'Bahamas', venue: '', currency: '$', pct: 2, note: '', createdAt: 1 };

describe('group swaps', () => {
  it('accepts 3 to 8 distinct names and rebuilds the terms', () => {
    const g = parseGroup({ ...terms, extra: 'x' }, ['Rui', 'Ana', 'João']);
    expect(g && g !== 'offensive' && g.terms).toEqual(terms);
    expect(parseGroup(terms, ['Rui', 'Ana'])).toBeNull();
    expect(parseGroup(terms, Array.from({ length: 9 }, (_, i) => `P${i}`))).toBeNull();
    expect(parseGroup(terms, ['Rui', 'rui', 'Ana'])).toBeNull();
    expect(parseGroup(terms, ['Rui', '-', 'Ana'])).toBeNull();
    expect(parseGroup({ ...terms, pct: 30 }, ['a', 'b', 'c'])).toBeNull();
  });

  it('payments must name a seat', () => {
    expect(parseGroupEntry({ cid: 'c', kind: 'payment', amount: 10 })).toBeNull();
    expect(parseGroupEntry({ cid: 'c', kind: 'payment', amount: 10, to: 2 })).toMatchObject({ to: 2 });
    expect(parseGroupEntry({ cid: 'c', kind: 'payment', amount: 10, to: 1.5 })).toBeNull();
    expect(parseGroupEntry({ cid: 'c', kind: 'result', amount: 0, to: 2 })).not.toHaveProperty('to');
  });

  it('the same prize saved twice by the server counts once', () => {
    const seats = [0, 1, 2].map((seat) => ({ seat }));
    const net = groupNet({ pct: 10 }, seats, [{ seat: 1, kind: 'result', amount: 1000, cid: 'x' }, { seat: 1, kind: 'result', amount: 1000, cid: 'x' }]);
    expect(net.get(1)).toBe(-200);
  });

  it('settles with the fewest transfers', () => {
    const seats = [0, 1, 2, 3].map((seat) => ({ seat }));
    const net = groupNet({ pct: 2 }, seats, [{ seat: 1, kind: 'result', amount: 100000 }]);
    expect([...net.values()].reduce((a, b) => a + b, 0)).toBe(0);
    expect(minTransfers(net)).toEqual([
      { from: 1, to: 0, amount: 2000 },
      { from: 1, to: 2, amount: 2000 },
      { from: 1, to: 3, amount: 2000 },
    ]);
  });
});

describe('seat gaps', () => {
  it('a seat dropped before anyone took it changes nothing for the others', () => {
    const seats = [{ seat: 0 }, { seat: 1 }, { seat: 3 }];
    const net = groupNet({ pct: 2 }, seats, [
      { seat: 3, kind: 'result', amount: 100000 },
      { seat: 1, kind: 'payment', amount: 500, to: 3 },
    ]);
    expect([...net.entries()]).toEqual([[0, 2000], [1, 2500], [3, -4500]]);
    expect(minTransfers(net).reduce((a, x) => a + x.amount, 0)).toBe(4500);
  });
});

describe('to the cent', () => {
  it('0,40 and 0,01 are still paid; only 0,00 is settled', () => {
    const net = new Map([[0, 0.4], [1, -0.41], [2, 0.01]]);
    expect(minTransfers(net)).toEqual([
      { from: 1, to: 0, amount: 0.4 },
      { from: 1, to: 2, amount: 0.01 },
    ]);
    expect(minTransfers(new Map([[0, 0.004], [1, -0.004]]))).toEqual([]);
  });
});

describe('received in a group', () => {
  it('is refused: groups settle seat to seat with payments', () => {
    expect(parseGroupEntry({ cid: 'r1', kind: 'received', amount: 10, to: 1 })).toBeNull();
  });
});
