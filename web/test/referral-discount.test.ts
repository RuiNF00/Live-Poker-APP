import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../src/lib/supabase', () => ({ serviceClient: () => null }));

// The local backend keeps its JSON under the working directory: give it a scratch one.
const cwd = process.cwd();
process.chdir(mkdtempSync(join(tmpdir(), 'ref-')));
afterAll(() => process.chdir(cwd));

const { OFFER_HOURS, referrals } = await import('../src/lib/referrals');

const ref = '11111111-1111-4111-8111-111111111111';
const friend = '22222222-2222-4222-8222-222222222222';

describe('invite reward is a discount, not Pro days', () => {
  it('books the discount for both and grants nothing on RevenueCat', async () => {
    const b = referrals()!;
    await b.codeFor(ref, 'ABCD2345', 'rc_ref');
    await b.codeFor(friend, 'FRND2345', 'rc_friend');
    expect(await b.claim(friend, 'ABCD2345', 'link', null)).toBe('ok');
    expect(await b.activate(friend)).toEqual([]);
    expect(await b.pending(ref)).toEqual([]);

    for (const id of [ref, friend]) {
      const o = await b.offer(id, 'android');
      expect(o).not.toBeNull();
      const left = Date.parse(o!.until) - Date.now();
      expect(left).toBeGreaterThan((OFFER_HOURS - 1) * 3_600_000);
      expect(left).toBeLessThanOrEqual(OFFER_HOURS * 3_600_000);
      expect(o!.iosCode).toBeNull();
    }
    const s = await b.status(ref);
    expect(s?.discounts).toBe(1);
    expect(s?.daysEarned).toBe(0);
    expect(s?.proUntil).toBeNull();
  });
});

describe('an inviter with no RevenueCat user yet (1st update)', () => {
  const web = '33333333-3333-4333-8333-333333333333';
  const pal = '44444444-4444-4444-8444-444444444444';
  it('gets their part once they report one', async () => {
    const b = referrals()!;
    await b.codeFor(web, 'WEBA2345', null);
    await b.codeFor(pal, 'PALA2345', 'rc_pal');
    expect(await b.claim(pal, 'WEBA2345', 'link', null)).toBe('ok');
    await b.activate(pal);
    expect(await b.offer(pal, 'android')).not.toBeNull();
    expect(await b.offer(web, 'android')).toBeNull();
    await b.codeFor(web, 'WEBA2345', 'rc_web');
    await b.codeFor(web, 'WEBA2345', 'rc_web');
    expect(await b.offer(web, 'android')).not.toBeNull();
    expect((await b.status(web))?.discounts).toBe(1);
  });
  it("gets nothing when the friend is the inviter's own store account", async () => {
    const b = referrals()!;
    const me = '55555555-5555-4555-8555-555555555555';
    const alt = '66666666-6666-4666-8666-666666666666';
    await b.codeFor(me, 'MEMA2345', null);
    await b.codeFor(alt, 'ALTA2345', 'rc_me');
    await b.claim(alt, 'MEMA2345', 'link', null);
    await b.activate(alt);
    await b.codeFor(me, 'MEMA2345', 'rc_me');
    expect((await b.status(me))?.discounts).toBe(0);
  });
});

describe('erasing one side (P2-B)', () => {
  it("keeps the other side's discount and drops the erased side's own", async () => {
    const b = referrals()!;
    const inv = '77777777-7777-4777-8777-777777777777';
    const pal = '88888888-8888-4888-8888-888888888888';
    await b.codeFor(inv, 'INVA2345', 'rc_inv');
    await b.codeFor(pal, 'PALB2345', 'rc_pal_b');
    await b.claim(pal, 'INVA2345', 'link', null);
    await b.activate(pal);
    await b.erase(inv);
    expect(await b.offer(pal, 'android')).not.toBeNull();
    expect(await b.offer(inv, 'android')).toBeNull();
  });
});
