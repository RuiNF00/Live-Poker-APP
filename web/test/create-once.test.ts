import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { SAMPLE_TOURNAMENT_HAND } from '@livepoker/hand-format';

// A create sent twice (a retry after a lost answer) makes one link or one comment (migration 340000).
vi.mock('server-only', () => ({}));
vi.mock('@/lib/abuse', async (orig) => ({ ...(await orig<typeof import('@/lib/abuse')>()), limited: async () => false }));
process.chdir(mkdtempSync(path.join(tmpdir(), 'once-')));
delete process.env.SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const hands = await import('../src/app/api/hands/route');
const live = await import('../src/app/api/live/route');
const { coachStore } = await import('@/lib/coach');

const K1 = 'a1'.repeat(32);
const K2 = 'b2'.repeat(32);
const post = (fn: (r: Request) => Promise<Response>, body: object) => fn(new Request('http://x/api', { method: 'POST', body: JSON.stringify(body) }));
const snapshot = {
  v: 1, player: 'Rui', kind: 'mtt', name: 'Main Event', venue: 'Casino Estoril', currency: '€', startedAt: 1_700_000_000_000,
  endedAt: null, playedMs: 3_600_000, paused: false, level: 12, sb: 400, bb: 800, ante: 800, stack: 45000,
  stackLog: [{ t: 1, stack: 30000 }], buyIn: 150, entries: 1, addOn: 0, invested: 150,
  cashOut: 0, finish: null, field: null, stage: 'mid', sold: 30, hands: 4, day: 1, bagged: false, updatedAt: 1_700_000_100_000,
};

describe('creates are safe to repeat', () => {
  it('a hand link sent twice with the same token is one link, with the app’s token', async () => {
    const a = await (await post(hands.POST, { hand: SAMPLE_TOURNAMENT_HAND, token: K1 })).json();
    const b = await (await post(hands.POST, { hand: SAMPLE_TOURNAMENT_HAND, token: K1 })).json();
    expect(b.id).toBe(a.id);
    expect(a.token).toBe(K1);
    const c = await (await post(hands.POST, { hand: SAMPLE_TOURNAMENT_HAND, token: K2 })).json();
    expect(c.id).not.toBe(a.id);
    // Older apps send no token and still get a new link each time.
    const d = await (await post(hands.POST, { hand: SAMPLE_TOURNAMENT_HAND })).json();
    expect(d.token).toMatch(/^[a-f0-9]+$/);
    expect((await post(hands.POST, { hand: SAMPLE_TOURNAMENT_HAND, token: 'short' })).status).toBe(422);
  });

  it('a backer live link sent twice with the same token is one link', async () => {
    const a = await (await post(live.POST, { snapshot, token: K1 })).json();
    const b = await (await post(live.POST, { snapshot, token: K1 })).json();
    expect(a.id).toBeTruthy();
    expect(b.id).toBe(a.id);
    expect(a.token).toBe(K1);
    expect((await post(live.POST, { snapshot, token: 'ZZ' })).status).toBe(422);
  });

  it('a coach comment or a reply sent twice with the same key is one comment', async () => {
    const store = coachStore();
    const { token, ownerToken } = await store.create('Rever', 'Rui', null, [{ id: 'h1', payload: { v: 1, id: 'h1' } }]);
    const c = { handId: 'h1', stepIndex: 2, mark: null, name: 'Ana', body: 'Fold.', key: 'coach-key-1' };
    const c1 = await store.comment(token, c);
    const c2 = await store.comment(token, c);
    expect(c2?.id).toBe(c1?.id);
    const r = { handId: 'h1', stepIndex: 2, name: 'Rui', body: 'Porquê?', key: 'local-abc123' };
    const r1 = await store.reply(token, ownerToken, r);
    const r2 = await store.reply(token, ownerToken, r);
    expect(r2?.id).toBe(r1?.id);
    expect(r1?.id).not.toBe(c1?.id);
    expect(await store.since(token, ownerToken, null)).toHaveLength(2);
    expect(JSON.stringify(await store.since(token, ownerToken, null))).not.toContain('local-abc123');
  });
});
