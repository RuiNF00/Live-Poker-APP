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

const { IdTaken, ownId, swapStore } = await import('../src/lib/swaps');
const { groupStore } = await import('../src/lib/swap-groups');
const { POST } = await import('../src/app/api/swaps/route');
const { POST: POSTGROUP } = await import('../src/app/api/swap-groups/route');

const k = (c: string) => c.repeat(64);
const terms = { v: 1, scope: 'event', title: 'Main', venue: '', currency: '$', a: { name: 'Rui', pct: 5 }, b: { name: 'Ana', pct: 5 }, note: '', createdAt: 1 };
const gt = { v: 1, scope: 'series', title: 'Bahamas', venue: '', currency: '$', pct: 2, note: '', createdAt: 1 };
const post = (fn: (r: Request) => Promise<Response>, body: unknown) => fn(new Request('http://x/api', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.0.0.' + Math.floor(Math.random() * 250) }, body: JSON.stringify(body) }));

describe('a swap made without signal: the app picks the id, so the link goes out first', () => {
  it('takes the id, returns the same swap when sent again, and refuses an id another swap has', async () => {
    const s = swapStore();
    const one = await s.create(terms as never, k('a'), 'AbCdE12345');
    expect(one.id).toBe('AbCdE12345');
    expect(await s.create(terms as never, k('a'), 'AbCdE12345')).toEqual(one);
    // The same draft again with another id (a second phone screen): still the first swap.
    expect((await s.create(terms as never, k('a'), 'ZzZzZ99999')).id).toBe('AbCdE12345');
    await expect(s.create(terms as never, k('b'), 'AbCdE12345')).rejects.toBeInstanceOf(IdTaken);
    expect(await s.side('AbCdE12345', k('a'))).toBe('a');
    expect(await s.side('AbCdE12345', k('b'))).toBeNull();
  });

  it('only takes 10 letters and digits, and only with the app’s own token', () => {
    expect(ownId('AbCdE12345', k('a'))).toBe('AbCdE12345');
    for (const bad of ['AbCdE1234', 'AbCdE123456', 'AbCdE-2345', '../../xx12', 42]) expect(ownId(bad, k('a'))).toBeUndefined();
    expect(ownId('AbCdE12345', undefined)).toBeUndefined();
  });

  it('the routes: 201 with the id, 409 id_taken for another token, a bad id ignored', async () => {
    const r1 = await post(POST, { terms, token: k('c'), id: 'Route00001' });
    expect(r1.status).toBe(201);
    expect((await r1.json()).id).toBe('Route00001');
    const r2 = await post(POST, { terms, token: k('d'), id: 'Route00001' });
    expect(r2.status).toBe(409);
    expect((await r2.json()).error).toBe('id_taken');
    const r3 = await post(POST, { terms, token: k('e'), id: '../bad' });
    expect(r3.status).toBe(201);
    expect((await r3.json()).id).not.toBe('../bad');
    // Without the app's own token the id is not taken: nobody could send the create again.
    const r4 = await post(POST, { terms, id: 'Route00002' });
    expect((await r4.json()).id).not.toBe('Route00002');
  });

  it('the same for a group', async () => {
    const g = groupStore();
    const one = await g.create(gt as never, ['Rui', 'Ana', 'João'], { token: k('f'), invite: k('0') }, 'Group00001');
    expect(one.id).toBe('Group00001');
    expect(await g.create(gt as never, ['Rui', 'Ana', 'João'], { token: k('f'), invite: k('0') }, 'Group00001')).toEqual(one);
    await expect(g.create(gt as never, ['Rui', 'Ana', 'João'], { token: k('1'), invite: k('2') }, 'Group00001')).rejects.toBeInstanceOf(IdTaken);
    const r = await post(POSTGROUP, { terms: gt, names: ['Rui', 'Ana', 'João'], token: k('3'), invite: k('4'), id: 'Group00001' });
    expect(r.status).toBe(409);
  });
});
