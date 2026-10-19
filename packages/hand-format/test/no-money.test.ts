import { describe, expect, it } from 'vitest';
import { withoutMoney } from '../src/no-money';

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
    // From the Staking review of #336: words, codes in any case, every stored currency, a $ before the next number.
    ['Main Event 50 euros', 'Main Event'],
    ['Torneio 100 eur', 'Torneio'],
    ['US$ 300 Deepstack', 'Deepstack'],
    ['CHF 300 Turbo', 'Turbo'],
    ['€5K GTD', 'GTD'],
    ['5K GTD', '5K GTD'],
    ['Main €550 + €50', 'Main'],
    ['Kings Rozvadov 500 Kč', 'Kings Rozvadov'],
    ['CA$ 200 Montreal', 'Montreal'],
    ['Event #12 $1500', 'Event #12'],
    ['Lima S/ 200', 'Lima'],
    ['Warsaw 300 zł', 'Warsaw'],
    ['Day 1A', 'Day 1A'],
    ['WSOP Event 55', 'WSOP Event 55'],
    ['Turbo 1/2', 'Turbo 1/2'],
    ['Copenhagen 500 DKK', 'Copenhagen'],
    ['Seoul ₩50000', 'Seoul'],
    ['Mystery 2,5k€', 'Mystery'],
    ['Eureka Prague', 'Eureka Prague'],
    ['Pesos Club', 'Pesos Club'],
  ])('%s → %s', (name, out) => expect(withoutMoney(name)).toBe(out));

  it('handles a missing name', () => {
    expect(withoutMoney(undefined)).toBe('');
    expect(withoutMoney(null)).toBe('');
  });
});
