import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
// The file-backed stores, in a scratch folder: no database in tests.
process.chdir(mkdtempSync(path.join(tmpdir(), 'swaps-own-id-')));
delete process.env.SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { idForToken, IdTaken, madeOffline, ownId, swapStore } = await import('../src/lib/swaps');
const { groupStore } = await import('../src/lib/swap-groups');
const { POST } = await import('../src/app/api/swaps/route');
const { POST: POSTGROUP } = await import('../src/app/api/swap-groups/route');

const k = (c: string) => c.repeat(64);
const SQL_A = 'b5b29b12c34491ac';
const terms = { v: 1, scope: 'event', title: 'Main', venue: '', currency: '$', a: { name: 'Rui', pct: 5 }, b: { name: 'Ana', pct: 5 }, note: '', createdAt: 1 };
const gt = { v: 1, scope: 'series', title: 'Bahamas', venue: '', currency: '$', pct: 2, note: '', createdAt: 1 };
const post = (fn: (r: Request) => Promise<Response>, body: unknown) => fn(new Request('http://x/api', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.0.0.' + Math.floor(Math.random() * 250) }, body: JSON.stringify(body) }));

describe('a swap made without signal: the id comes from the app’s token, so the link goes out first', () => {
  it('matches the database (swap_own_id) and the app', () => {
    // select swap_own_id(repeat('a', 64)) on Postgres; the app test checks the same value.
    expect(idForToken(k('a'))).toBe(SQL_A);
    expect(idForToken(k('a'))).toMatch(/^[a-f0-9]{16}$/);
  });

  it('takes the id, returns the same swap when sent again, and refuses one already there', async () => {
    const s = swapStore();
    const id = idForToken(k('a'));
    const one = await s.create(terms as never, k('a'), id);
    expect(one.id).toBe(id);
    expect(await s.create(terms as never, k('a'), id)).toEqual(one);
    // Only if two tokens ever gave the same id (the store itself doesn't check the token).
    await expect(s.create(terms as never, k('b'), id)).rejects.toBeInstanceOf(IdTaken);
    expect(await s.side(id, k('a'))).toBe('a');
    expect(await s.side(id, k('b'))).toBeNull();
  });

  it('the page tells a link made without signal (16 hex) from a server id (10 letters and digits)', () => {
    expect(madeOffline(idForToken(k('a')))).toBe(true);
    for (const id of ['AbCdE12345', 'abcdef1234', 'B5B29B12C34491AC', '../b5b29b12c344']) expect(madeOffline(id)).toBe(false);
  });

  it('only takes the id its own token gives', () => {
    expect(ownId(idForToken(k('a')), k('a'))).toBe(idForToken(k('a')));
    for (const bad of [idForToken(k('b')), 'AbCdE12345', '../../xx12', 42]) expect(ownId(bad, k('a'))).toBeUndefined();
    expect(ownId(idForToken(k('a')), undefined)).toBeUndefined();
  });

  it('the routes: 201 with the id; someone else’s id or a made-up one is not taken', async () => {
    const r1 = await post(POST, { terms, token: k('c'), id: idForToken(k('c')) });
    expect(r1.status).toBe(201);
    expect((await r1.json()).id).toBe(idForToken(k('c')));
    // Someone who saw the link early, with their own token: a new swap, never that id.
    const r2 = await post(POST, { terms, token: k('d'), id: idForToken(k('c')) });
    expect(r2.status).toBe(201);
    expect((await r2.json()).id).not.toBe(idForToken(k('c')));
    const r3 = await post(POST, { terms, token: k('e'), id: '../bad' });
    expect((await r3.json()).id).not.toBe('../bad');
    const r4 = await post(POST, { terms, id: idForToken(k('5')) });
    expect((await r4.json()).id).not.toBe(idForToken(k('5')));
  });

  it('the same for a group (the id from the creator’s seat token)', async () => {
    const id = idForToken(k('f'));
    const r = await post(POSTGROUP, { terms: gt, names: ['Rui', 'Ana', 'João'], token: k('f'), invite: k('0'), id });
    expect(r.status).toBe(201);
    expect((await r.json()).id).toBe(id);
    const again = await groupStore().create(gt as never, ['Rui', 'Ana', 'João'], { token: k('f'), invite: k('0') }, id);
    expect(again.id).toBe(id);
    await expect(groupStore().create(gt as never, ['Rui', 'Ana', 'João'], { token: k('1'), invite: k('2') }, id)).rejects.toBeInstanceOf(IdTaken);
    const other = await post(POSTGROUP, { terms: gt, names: ['Rui', 'Ana', 'João'], token: k('3'), invite: k('4'), id });
    expect((await other.json()).id).not.toBe(id);
  });
});
