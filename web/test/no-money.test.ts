import { describe, expect, it } from 'vitest';
import { withoutMoney } from '../src/lib/no-money';

describe('link previews carry no money', () => {
  it.each([
    ['Main Event €550', 'Main Event'],
    ['Torneio de domingo 100€ · Final', 'Torneio de domingo · Final'],
    ['€1/€2 Noite', 'Noite'],
    ['Cash 2/5 €', 'Cash'],
    ['High Roller $5k', 'High Roller'],
    ['Mystery R$ 300', 'Mystery'],
    ['Deepstack 250EUR', 'Deepstack'],
    ['Estoril Poker Series Main Event', 'Estoril Poker Series Main Event'],
    ['6-Max 2025', '6-Max 2025'],
    ['1/2 €', ''],
  ])('%s → %s', (name, out) => expect(withoutMoney(name)).toBe(out));

  it('handles a missing name', () => {
    expect(withoutMoney(undefined)).toBe('');
    expect(withoutMoney(null)).toBe('');
  });
});
