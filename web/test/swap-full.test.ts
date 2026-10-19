import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
// The file-backed stores, in a scratch folder: no database in tests.
process.chdir(mkdtempSync(path.join(tmpdir(), 'swaps-full-')));
delete process.env.SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { MAX_SWAP_ENTRIES, swapStore } = await import('../src/lib/swaps');
const { MAX_GROUP_ENTRIES, groupStore } = await import('../src/lib/swap-groups');

const k = (c: string) => c.repeat(64);
const terms = { v: 1, scope: 'series', title: 'Main', venue: '', currency: '$', a: { name: 'Rui', pct: 5 }, b: { name: 'Ana', pct: 5 }, note: '', createdAt: 1 } as never;
const entry = (cid: string) => ({ cid, kind: 'result' as const, event: '', amount: 10, finish: null });

describe('a swap at the most entries the database keeps (Security P3, 19 Oct)', () => {
  it('answers full instead of failing, and a retry of a saved entry still counts as saved', async () => {
    const s = swapStore();
    const { id, token } = await s.create(terms, k('a'));
    await s.confirm(id, 'Ana', k('b'));
    for (let i = 0; i < MAX_SWAP_ENTRIES; i++) expect(await s.addEntry(id, token, entry(`c${i}`))).toBe(true);
    expect(await s.addEntry(id, token, entry('one-more'))).toBe('full');
    expect(await s.addEntry(id, k('b'), entry('theirs'))).toBe('full');
    expect(await s.addEntry(id, token, entry('c0'))).toBe(true);
    expect((await s.get(id))?.entries).toHaveLength(MAX_SWAP_ENTRIES);
  });

  it('the same for a group', async () => {
    const g = groupStore();
    const gt = { v: 1, scope: 'series', title: 'Bahamas', venue: '', currency: '$', pct: 2, note: '', createdAt: 1 } as never;
    const { id, token, invite } = await g.create(gt, ['Rui', 'Ana', 'João'], { token: k('c'), invite: k('d') });
    await g.claim(id, invite, 1, k('e'));
    await g.claim(id, invite, 2, k('f'));
    for (let i = 0; i < MAX_GROUP_ENTRIES; i++) expect(await g.addEntry(id, token, entry(`c${i}`))).toBe(true);
    expect(await g.addEntry(id, k('e'), entry('one-more'))).toBe('full');
    expect(await g.addEntry(id, token, entry('c0'))).toBe(true);
  });
});
