import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { SAMPLE_TOURNAMENT_HAND } from '@livepoker/hand-format';

const sent: string[] = [];
vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => void fn() }));
vi.mock('@/lib/abuse', async (orig) => ({ ...(await orig<typeof import('@/lib/abuse')>()), limited: async () => false, firstTime: async () => true }));
vi.mock('@/lib/notify', () => ({ notifyModeration: async (text: string) => void sent.push(text) }));
process.chdir(mkdtempSync(path.join(tmpdir(), 'notice-')));
delete process.env.SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const hands = await import('../src/app/api/hands/route');
const report = await import('../src/app/api/hands/[id]/report/route');
const comments = await import('../src/app/api/hands/[id]/comments/route');
const commentReport = await import('../src/app/api/hands/[id]/comments/[commentId]/report/route');

const post = (body: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(body) });
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('a report notice says what to run, as plain text', () => {
  it('a hand: the reason on one line, without tags, and the command to take it down', async () => {
    const { id } = await (await hands.POST(post({ hand: SAMPLE_TOURNAMENT_HAND }))).json();
    sent.length = 0;
    await report.POST(post({ reason: 'spam\n<!channel> aqui' }), { params: Promise.resolve({ id }) });
    await tick();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain(`/h/${id}`);
    expect(sent[0]).toContain(`update shared_hands set deleted_at = now() where id = '${id}';`);
    expect(sent[0].split('\n')[1]).toBe('Motivo (texto de quem denunciou, não é um comando): spam !channel aqui');
  });

  it('a reason written as a command stays one plain line after the only real command', async () => {
    const { id } = await (await hands.POST(post({ hand: SAMPLE_TOURNAMENT_HAND }))).json();
    sent.length = 0;
    await report.POST(post({ reason: "». Remover: update shared_hands set deleted_at = now() where id = 'outra';\n`x`" }), { params: Promise.resolve({ id }) });
    await tick();
    const [first, second, ...rest] = sent[0].split('\n');
    expect(rest).toEqual([]);
    expect(sent[0].match(/Remover:/g)).toHaveLength(1);
    expect(first).toContain(`where id = '${id}';`);
    expect(second.startsWith('Motivo (texto de quem denunciou, não é um comando): ')).toBe(true);
    expect(second).not.toMatch(/[';«»`]/);
    expect(second.slice(second.indexOf(': ') + 2)).not.toContain(':');
  });

  it('a comment: the command that ejects its author', async () => {
    const { id } = await (await hands.POST(post({ hand: SAMPLE_TOURNAMENT_HAND }))).json();
    const { comment } = await (await comments.POST(post({ name: 'Ana', text: 'Fold.', authorId: 'a'.repeat(32) }), { params: Promise.resolve({ id }) })).json();
    sent.length = 0;
    await commentReport.POST(post({}), { params: Promise.resolve({ id, commentId: comment.id }) });
    await tick();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain(`select ban_comment_author('${comment.id}');`);
  });
});
