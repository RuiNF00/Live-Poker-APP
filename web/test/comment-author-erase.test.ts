import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { SAMPLE_TOURNAMENT_HAND } from '@livepoker/hand-format';

// "Delete all my data" in the app also deletes what it wrote on other players' hands.
vi.mock('server-only', () => ({}));
// The routes purge and notify with after(), which needs a request scope the test doesn't have.
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: () => {} }));
vi.mock('@/lib/abuse', async (orig) => ({ ...(await orig<typeof import('@/lib/abuse')>()), limited: async () => false }));
process.chdir(mkdtempSync(path.join(tmpdir(), 'erase-comments-')));
delete process.env.SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const hands = await import('../src/app/api/hands/route');
const comments = await import('../src/app/api/hands/[id]/comments/route');
const mine = await import('../src/app/api/hands/my-comments/route');

const req = (method: string, body: object) => new Request('http://x/api', { method, body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const list = async (id: string) => ((await (await comments.GET(new Request('http://x/api'), ctx(id))).json()) as { comments: { name: string }[] }).comments;

describe('erasing my comments', () => {
  it('removes every comment of this app install, on every hand, and nobody else’s', async () => {
    const a = await (await hands.POST(req('POST', { hand: SAMPLE_TOURNAMENT_HAND }))).json();
    const b = await (await hands.POST(req('POST', { hand: SAMPLE_TOURNAMENT_HAND }))).json();
    const me = 'local-author-1234';
    await comments.POST(req('POST', { name: 'Ana', text: 'Fold.', authorId: me }), ctx(a.id));
    await comments.POST(req('POST', { name: 'Ana', text: 'Call.', authorId: me }), ctx(b.id));
    await comments.POST(req('POST', { name: 'Rui', text: 'Shove.', authorId: 'someone-else-99' }), ctx(a.id));
    await comments.POST(req('POST', { name: 'Zé', text: 'Sem id.' }), ctx(a.id));

    const res = await mine.DELETE(req('DELETE', { authorId: me }));
    expect(res.status).toBe(200);
    expect((await res.json()).deleted).toBe(2);
    expect((await list(a.id)).map((c) => c.name).sort()).toEqual(['Rui', 'Zé']);
    expect(await list(b.id)).toEqual([]);
    // Sent again from the outbox: nothing left, still fine.
    expect((await (await mine.DELETE(req('DELETE', { authorId: me }))).json()).deleted).toBe(0);
  });

  it('refuses a missing or malformed id', async () => {
    expect((await mine.DELETE(req('DELETE', {}))).status).toBe(422);
    expect((await mine.DELETE(req('DELETE', { authorId: 'x' }))).status).toBe(422);
  });
});
