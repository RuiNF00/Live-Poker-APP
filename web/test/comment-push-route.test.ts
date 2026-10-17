import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { SAMPLE_TOURNAMENT_HAND } from '@livepoker/hand-format';

vi.mock('server-only', () => ({}));
// after() has no request scope in tests: its work is collected so each check can wait for it.
const work = vi.hoisted(() => [] as Promise<unknown>[]);
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => void work.push(Promise.resolve().then(fn)) }));
const settled = () => Promise.all(work.splice(0));
const notifyOwner = vi.fn(async () => {});
vi.mock('@/lib/comment-push', () => ({ notifyOwner }));
vi.mock('@/lib/abuse', async (orig) => ({ ...(await orig<typeof import('@/lib/abuse')>()), limited: async () => false }));
// The file-backed store, in a scratch folder: no database in tests.
process.chdir(mkdtempSync(path.join(tmpdir(), 'push-')));
delete process.env.SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { getStore } = await import('@/lib/store');
const { POST } = await import('../src/app/api/hands/[id]/comments/route');

const post = (id: string, body: object, owner?: string) =>
  POST(new Request(`http://x/api/hands/${id}/comments`, { method: 'POST', body: JSON.stringify(body), headers: owner ? { 'x-edit-token': owner } : {} }), {
    params: Promise.resolve({ id }),
  });

describe('the owner notice follows the comment', () => {
  it('a comment notifies the owner on its street; a blocked or offensive one never does', async () => {
    const store = getStore();
    const { id, editToken } = await store.createShare({ payload: SAMPLE_TOURNAMENT_HAND });
    const ok = await post(id, { name: 'Troll', text: 'Pagava o turn', street: 'turn', authorId: 'troll-device-1' });
    expect(ok.status).toBe(201);
    await settled();
    expect(notifyOwner).toHaveBeenCalledWith(id, 'turn');
    const { comment } = (await ok.json()) as { comment: { id: string } };
    expect(await store.removeComment(comment.id, editToken, true)).toBe(true);
    notifyOwner.mockClear();
    expect((await post(id, { name: 'Troll', text: 'outra vez', authorId: 'troll-device-1' })).status).toBe(403);
    expect((await post(id, { name: 'Zé', text: 'filho da puta' })).status).toBe(422);
    await settled();
    expect(notifyOwner).not.toHaveBeenCalled();
    expect((await post(id, { name: 'Autor da mão', text: '@Ana obrigado' }, editToken)).status).toBe(201);
    await settled();
    expect(notifyOwner).not.toHaveBeenCalled();
    expect((await post(id, { name: 'Ana', text: 'de nada' }, 'not-the-token')).status).toBe(201);
    await settled();
    expect(notifyOwner).toHaveBeenCalledOnce();
  });
});
