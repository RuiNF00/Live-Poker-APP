import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// The local store (dev and tests) follows the same rules as the Supabase functions.
let dir = '';
let cwd = '';
beforeAll(async () => {
  cwd = process.cwd();
  dir = await mkdtemp(path.join(tmpdir(), 'sb-'));
  process.chdir(dir);
});
afterAll(async () => {
  process.chdir(cwd);
  await rm(dir, { recursive: true, force: true });
});

describe('owner removes and blocks', () => {
  it('hides, blocks the author on that hand, and counts', async () => {
    delete process.env.SUPABASE_URL;
    const { getStore } = await import('../src/lib/store');
    const store = getStore();
    const { id, editToken } = await store.createShare({ payload: { version: 1 }, title: 'x', allowComments: true });
    const troll = await store.addComment(id, { name: 'Troll', text: 'lixo', stepIndex: null, authorKey: 'kT' });
    await store.addComment(id, { name: 'Troll', text: 'mais', stepIndex: null, authorKey: 'kT' });
    await store.addComment(id, { name: 'Ana', text: 'Bom fold', stepIndex: null, authorKey: 'kA' });
    expect(await store.commentCounts([id, 'nope'])).toEqual({ [id]: 3 });
    expect(await store.removeComment(troll!.id, 'wrong', true)).toBe(false);
    expect(await store.removeComment(troll!.id, editToken, true)).toBe(true);
    const left = await store.listComments(id);
    expect(left.map((c) => c.name)).toEqual(['Ana']);
    expect(JSON.stringify(left)).not.toContain('kA');
    await expect(store.addComment(id, { name: 'Troll', text: 'voltei', stepIndex: null, authorKey: 'kT' })).rejects.toThrow('blocked');
    expect(await store.commentCounts([id])).toEqual({ [id]: 1 });
  });
});
