import { describe, expect, it } from 'vitest';
import { appHref } from '../src/lib/app-link';

describe('appHref', () => {
  it('uses the scheme on iPhone', () => {
    expect(appHref('h/abc?r=ABCDEFGH', false)).toBe('sweatbook://h/abc?r=ABCDEFGH');
  });
  it('uses an intent on Android, so in-app browsers hand it to the system', () => {
    expect(appHref('h/abc?r=ABCDEFGH', true)).toBe('intent://h/abc?r=ABCDEFGH#Intent;scheme=sweatbook;package=com.ruinf.sweatbook;end');
  });
});
