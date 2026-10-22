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
      new Request('http://x/api/hands', { method: 'POST', body: JSON.stringify({ hand: { ...SAMPLE_TOURNAMENT_HAND, ...PRIVATE, notes: 'Hero call?', players: SAMPLE_TOURNAMENT_HAND.players.map((p, i) => (i ? { ...p, playerId: 'p_secret' } : p)) } }) }),
    );
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const stored = (await (await one.GET(new Request('http://x'), ctx(id))).json()).hand as Record<string, unknown>;
    for (const key of Object.keys(PRIVATE)) expect(stored).not.toHaveProperty(key);
    expect(stored.notes).toBe('Hero call?');
    expect(JSON.stringify(stored.players)).not.toContain('playerId');
  });
});

// The app's own format, as the phone sends it: a tournament with its buy-in and venue.
const APP_HAND = {
  v: 1, id: 'h_buyin', createdAt: 0, updatedAt: 0,
  game: { kind: 'mtt', name: 'Main Event', venue: 'Estoril', buyIn: 100, sb: 100, bb: 200, ante: 200, anteType: 'bb', level: 1, currency: '€' },
  players: [{ name: 'Hero', stack: 30000, cards: ['As', 'Kh'] }, { name: '', stack: 30000 }, { name: '', stack: 30000 }],
  button: 0, hero: 0, actions: [{ p: 1, kind: 'fold' }, { p: 2, kind: 'fold' }], board: [], tags: [], notes: '',
};

describe('the buy-in and the venue never reach anyone with the link', () => {
  it('are dropped before storing', async () => {
    const res = await hands.POST(new Request('http://x/api/hands', { method: 'POST', body: JSON.stringify({ hand: APP_HAND }) }));
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const { game } = (await (await one.GET(new Request('http://x'), ctx(id))).json()).hand;
    expect(game).not.toHaveProperty('buyIn');
    expect(game).not.toHaveProperty('venue');
    expect(game.name).toBe('Main Event');
  });

  it('are not served for a hand stored before they were dropped', async () => {
    const { getStore } = await import('../src/lib/store');
    const { id } = await getStore().createShare({ payload: APP_HAND, title: null, revealAll: false, quiz: null, allowComments: true, token: 'a'.repeat(64) });
    const body = await (await one.GET(new Request('http://x'), ctx(id))).json();
    expect(JSON.stringify(body)).not.toContain('Estoril');
    expect(body.hand.game).not.toHaveProperty('buyIn');
  });
});

describe('names at the table pass the comment filter', () => {
  it('drops an offensive name and keeps the others', async () => {
    const players = SAMPLE_TOURNAMENT_HAND.players.map((p, i) => (i === 1 ? { ...p, name: 'CABRÃO' } : i === 2 ? { ...p, name: 'Ana' } : p));
    const res = await hands.POST(new Request('http://x/api/hands', { method: 'POST', body: JSON.stringify({ hand: { ...SAMPLE_TOURNAMENT_HAND, players } }) }));
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const stored = (await (await one.GET(new Request('http://x'), ctx(id))).json()).hand as { players: { name?: string }[] };
    expect(stored.players).toHaveLength(players.length);
    expect(stored.players[1].name).toBe('');
    expect(stored.players[2].name).toBe('Ana');
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
