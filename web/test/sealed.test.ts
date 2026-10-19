import { describe, expect, it } from 'vitest';
import { checkStatement } from '../src/lib/backing';
import { openSealed, parseSealed, sealedRef } from '../src/lib/sealed';

// Sealed by the app's src/lib/sealed-link.ts (fixed key and nonce): the page must open it as is.
const KEY = 'AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA';
const SEALED = {
  v: 1 as const,
  n: 'yMfGxcTDwsHAv769',
  c: 'jxUEk4ef2vrUuNkT4b4KL1mwnlNrOlw34e2DH9kdd_L5MyUi8ZXoxa1HPeL_Ce4W3zFFCeP62P9wqiqQjUcc2bZfsAyGUCergDywYVCwu7qoVDqLR13y6wNn1IsJ2jCgTM82Y94cEF3jJPzENIBa7COS2qYTxisfNzvuUis2rFI',
};

describe('sealed backer pages', () => {
  it('opens what the app sealed, accents and cents intact', async () => {
    const st = checkStatement(await openSealed(SEALED, 'AbCdEf1234', KEY));
    expect(st?.bk).toBe('João');
    expect(st?.bal).toBe(4629.63);
  });

  it('a page moved under another id, or the wrong key, opens nothing', async () => {
    expect(await openSealed(SEALED, 'ZZZZZZ9999', KEY)).toBeNull();
    expect(await openSealed(SEALED, 'AbCdEf1234', KEY.replace('A', 'B'))).toBeNull();
    expect(await openSealed({ ...SEALED, c: SEALED.c.replace('j', 'k') }, 'AbCdEf1234', KEY)).toBeNull();
  });

  it('reads the link fragment, and leaves one-off statement links alone', () => {
    expect(sealedRef(`#s=AbCdEf1234.${KEY}`)).toEqual({ id: 'AbCdEf1234', key: KEY });
    expect(sealedRef('#eyJ2IjoxfQ')).toBeNull();
    expect(sealedRef(`#s=AbCdEf1234.${KEY.slice(1)}`)).toBeNull();
  });

  it('the server stores the shape only', () => {
    expect(parseSealed(SEALED)).toEqual(SEALED);
    expect(parseSealed({ ...SEALED, v: 2 })).toBeNull();
    expect(parseSealed({ ...SEALED, n: 'short' })).toBeNull();
    expect(parseSealed({ ...SEALED, c: 'x'.repeat(60001) })).toBeNull();
    expect(parseSealed({ ...SEALED, c: '<script>' })).toBeNull();
  });
});
