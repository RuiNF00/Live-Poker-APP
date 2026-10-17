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
