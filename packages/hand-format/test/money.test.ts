import { describe, expect, it } from 'vitest';
import { localeFormat, moneyIn, unbroken } from '../src';

describe('money that never splits across lines', () => {
  it('keeps a letter-code currency on the same line as its amount', () => {
    expect(moneyIn(localeFormat('pt-PT'), 300, 'SEK')).toBe('300 SEK');
    expect(moneyIn(localeFormat('en'), 1250, 'CHF')).toBe('CHF 1,250');
  });

  it('holds a store price together: spaces and letters next to the symbol', () => {
    expect(unbroken('16,67 US$')).toBe('16,67 US⁠$');
    expect(unbroken('R$ 91,66')).toBe('R⁠$ 91,66');
    expect(unbroken('CA$23.33')).toBe('CA⁠$23.33');
    expect(unbroken('16,67 €')).toBe('16,67 €');
    expect(unbroken('$16.67')).toBe('$16.67');
    // Idempotent: a price that went through once is unchanged the second time.
    expect(unbroken(unbroken('R$ 91,66'))).toBe('R⁠$ 91,66');
  });
});
