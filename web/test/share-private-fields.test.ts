import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { SAMPLE_TOURNAMENT_HAND } from '@livepoker/hand-format';

vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: () => {} }));
vi.mock('@/lib/abuse', async (orig) => ({ ...(await orig<typeof import('@/lib/abuse')>()), limited: async () => false }));
process.chdir(mkdtempSync(path.join(tmpdir(), 'private-')));
delete process.env.SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const hands = await import('../src/app/api/hands/route');
const one = await import('../src/app/api/hands/[id]/route');
const vote = await import('../src/app/api/hands/[id]/vote/route');

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const PRIVATE = {
  streetNotes: { flop: 'tilt' },
  reviewNote: 'misplayed',
  voiceNote: 'file:///memo.m4a',
  folders: ['leaks'],
  review: { verdict: 'bad' },
  reviewedAt: 1_700_000_000_000,
  shareToken: 'secret',
  sessionId: 'session-1',
};

describe('a shared hand keeps the player’s private fields off the server', () => {
  it('strips them before storing, and keeps the notes the player chose to share', async () => {
    const res = await hands.POST(
      new Request('http://x/api/hands', { method: 'POST', body: JSON.stringify({ hand: { ...SAMPLE_TOURNAMENT_HAND, ...PRIVATE, notes: 'Hero call?' } }) }),
    );
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const stored = (await (await one.GET(new Request('http://x'), ctx(id))).json()).hand as Record<string, unknown>;
    for (const key of Object.keys(PRIVATE)) expect(stored).not.toHaveProperty(key);
    expect(stored.notes).toBe('Hero call?');
  });
});

describe('GET vote?reveal=1', () => {
  it('sends the whole hand without a vote, and 404 for a missing one', async () => {
    const { id } = await (await hands.POST(new Request('http://x/api/hands', { method: 'POST', body: JSON.stringify({ hand: SAMPLE_TOURNAMENT_HAND }) }))).json();
    const res = await vote.GET(new Request(`http://x/api/hands/${id}/vote?reveal=1`), ctx(id));
    expect(res.status).toBe(200);
    const { hand } = await res.json();
    expect(hand.actions).toEqual(SAMPLE_TOURNAMENT_HAND.actions);
    expect((await vote.GET(new Request('http://x/api/hands/nope/vote?reveal=1'), ctx('nope'))).status).toBe(404);
    // Without the flag, still only the counts.
    expect(await (await vote.GET(new Request(`http://x/api/hands/${id}/vote`), ctx(id))).json()).toHaveProperty('counts');
  });
});
