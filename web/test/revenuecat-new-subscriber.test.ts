import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { isNewSubscriber } = await import('../src/lib/revenuecat');

const now = Date.parse('2026-10-19T05:00:00Z');
const seen = (first_seen: string) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ subscriber: { first_seen } }), { status: 200 })));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// Security, 19 Oct: the v1 lookup creates a customer it doesn't know, so "first seen just now"
// is what a made-up id looks like.
describe('a new RevenueCat user for an invite', () => {
  it('counts a user first seen a few minutes to a few days ago', async () => {
    vi.stubEnv('REVENUECAT_SECRET_KEY', 'sk_test');
    seen('2026-10-19T04:50:00Z');
    expect(await isNewSubscriber('a', 7, now)).toBe(true);
  });

  it('refuses one first seen in the last minute, and one older than the window', async () => {
    vi.stubEnv('REVENUECAT_SECRET_KEY', 'sk_test');
    seen('2026-10-19T04:59:30Z');
    expect(await isNewSubscriber('a', 7, now)).toBe(false);
    seen('2026-10-01T00:00:00Z');
    expect(await isNewSubscriber('a', 7, now)).toBe(false);
  });
});
