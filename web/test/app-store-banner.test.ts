import { describe, expect, it } from 'vitest';
import { appStoreBanner } from '../src/lib/storeLinks';

describe('appStoreBanner', () => {
  it('takes the app id from the App Store link', () => {
    expect(appStoreBanner('https://apps.apple.com/app/id6824088230')).toEqual({ appId: '6824088230' });
    expect(appStoreBanner('https://apps.apple.com/pt/app/sweatbook/id6824088230?l=pt')).toEqual({ appId: '6824088230' });
  });
  it('shows no banner while the link is not set', () => {
    expect(appStoreBanner('')).toBeNull();
  });
});
