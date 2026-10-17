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

describe('a confirm or a seat claim sent again (automatic retry after a lost answer)', () => {
  it('lets the other player in with the same token, and nobody else', async () => {
    const s = swapStore();
    const { id, token: ta } = await s.create(terms);
    expect(await s.confirm(id, 'Ana', ta)).toBeNull(); // never the creator's token
    expect(await s.confirm(id, 'Ana', k('1'))).toBe(k('1'));
    expect(await s.confirm(id, 'Ana', k('1'))).toBe(k('1'));
    expect(await s.side(id, k('1'))).toBe('b');
    expect(await s.confirm(id, 'Eva', k('2'))).toBeNull();
    expect(await s.confirm(id, 'Eva')).toBeNull();
    expect((await s.get(id))?.confirmedName).toBe('Ana');
  });

  it('gives the same seat back for the same token, never a second seat', async () => {
    const g = groupStore();
    const gt = { v: 1, scope: 'series', title: 'Bahamas', venue: '', currency: '$', pct: 2, note: '', createdAt: 1 } as never;
    const { id, invite } = await g.create(gt, ['Rui', 'Ana', 'João']);
    expect(await g.claim(id, invite, 1, k('3'))).toBe(k('3'));
    expect(await g.claim(id, invite, 1, k('3'))).toBe(k('3'));
    expect(await g.seat(id, k('3'))).toBe(1);
    expect(await g.claim(id, invite, 2, k('3'))).toBeNull();
    expect(await g.claim(id, invite, 1, k('4'))).toBeNull();
    expect(await g.claim(id, k('4'), 1, k('3'))).toBeNull();
  });
});
