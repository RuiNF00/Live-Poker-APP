import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
// The file-backed stores, in a scratch folder: no database in tests.
process.chdir(mkdtempSync(path.join(tmpdir(), 'swaps-')));
delete process.env.SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { ownToken, swapStore } = await import('../src/lib/swaps');
const { groupStore } = await import('../src/lib/swap-groups');

const k = (c: string) => c.repeat(64);
const terms = { v: 1, scope: 'event', title: 'Main', venue: '', currency: '$', a: { name: 'Rui', pct: 5 }, b: { name: 'Ana', pct: 5 }, note: '', createdAt: 1 } as never;

describe('a create sent again (automatic retry after a lost answer)', () => {
  it('returns the same swap for the same app token', async () => {
    const s = swapStore();
    const one = await s.create(terms, k('a'));
    const two = await s.create(terms, k('a'));
    expect(two).toEqual(one);
    expect(one.token).toBe(k('a'));
    expect(await s.side(one.id, k('a'))).toBe('a');
    expect((await s.create(terms, k('b'))).id).not.toBe(one.id);
    expect((await s.create(terms)).token).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns the same group for the same token and invite', async () => {
    const g = groupStore();
    const gt = { v: 1, scope: 'series', title: 'Bahamas', venue: '', currency: '$', pct: 2, note: '', createdAt: 1 } as never;
    const one = await g.create(gt, ['Rui', 'Ana', 'João'], { token: k('c'), invite: k('d') });
    const two = await g.create(gt, ['Rui', 'Ana', 'João'], { token: k('c'), invite: k('d') });
    expect(two).toEqual(one);
    expect((await g.create(gt, ['Rui', 'Ana', 'João'], { token: k('c'), invite: k('e') })).id).not.toBe(one.id);
  });

  it('only takes 64 hex characters from the app', () => {
    expect(ownToken(k('a'))).toBe(k('a'));
    expect(ownToken('abc')).toBeUndefined();
    expect(ownToken(k('A'))).toBeUndefined();
    expect(ownToken(42)).toBeUndefined();
  });
});
