import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../src/lib/supabase', () => ({ serviceClient: () => null }));
vi.mock('@/lib/abuse', async (orig) => ({ ...(await orig<typeof import('@/lib/abuse')>()), limited: async () => false }));
const rcState = vi.hoisted(() => ({ configured: false, fresh: true }));
vi.mock('@/lib/revenuecat', async (orig) => ({
  ...(await orig<typeof import('@/lib/revenuecat')>()),
  revenueCatConfigured: () => rcState.configured,
  isNewSubscriber: async () => rcState.fresh,
}));

const cwd = process.cwd();
process.chdir(mkdtempSync(join(tmpdir(), 'act-')));
afterAll(() => process.chdir(cwd));

const { referrals } = await import('../src/lib/referrals');
const { POST } = await import('../src/app/api/referrals/activate/route');

const activate = async (installId: string, rcUserId?: string) =>
  (await (await POST(new Request('http://x/api/referrals/activate', { method: 'POST', body: JSON.stringify({ installId, rcUserId }) }))).json()) as { booked: boolean };

let n = 0;
/** A referrer and a fresh friend who claimed its code. */
async function invited() {
  const b = referrals()!;
  n += 1;
  const ref = `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
  const friend = `22222222-2222-4222-8222-${String(n).padStart(12, '0')}`;
  const code = await b.codeFor(ref, `REFA${'ABCDEFGHJK'[n]}234`, `rc_ref_${n}`);
  expect(await b.claim(friend, code, 'link', null)).toBe('ok');
  return friend;
}

afterEach(() => {
  rcState.configured = false;
  rcState.fresh = true;
  vi.unstubAllEnvs();
});

// Security P1 (19 Oct): a made-up install with no RevenueCat user used to book a discount.
describe('activating an invite needs a new RevenueCat user', () => {
  it('books nothing without the friend’s RevenueCat user', async () => {
    const friend = await invited();
    expect((await activate(friend)).booked).toBe(false);
    expect(await referrals()!.offer(friend, 'android')).toBeNull();
  });

  it('books once RevenueCat says the user is new', async () => {
    rcState.configured = true;
    const friend = await invited();
    expect((await activate(friend, 'rc_new_friend')).booked).toBe(true);
  });

  it('books nothing for a RevenueCat user that is not new', async () => {
    rcState.configured = true;
    rcState.fresh = false;
    const friend = await invited();
    expect((await activate(friend, 'rc_old_friend')).booked).toBe(false);
  });

  it('in production without RevenueCat set up, books nothing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const friend = await invited();
    expect((await activate(friend, 'rc_prod_friend')).booked).toBe(false);
  });
});
