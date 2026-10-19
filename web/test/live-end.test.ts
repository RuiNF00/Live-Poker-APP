import { generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../src/lib/supabase', () => ({ serviceClient: () => null }));
vi.mock('../src/lib/abuse', () => ({ limited: async () => false }));

const { apnsJwt, endPayload, liveEnd } = await import('../src/lib/live-end');
const { PUT, POST } = await import('../src/app/api/live-end/[id]/route');

const ID = '0123456789';
const KEY = 'ABCDEFGHJKMNPQRS';
const SLOT = 'a'.repeat(32);
const params = Promise.resolve({ id: ID });
const req = (method: string, body: unknown, key = KEY) =>
  new Request(`http://x/api/live-end/${ID}`, { method, headers: { 'x-backup-key': key, 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('push-to-end', () => {
  it('ends at once and carries nothing of the session', () => {
    const p = endPayload(1_700_000_000_000);
    expect(p).toEqual({ aps: { timestamp: 1_700_000_000, event: 'end', 'dismissal-date': 1_700_000_000, 'content-state': { name: 'SweatbookSession' } } });
  });

  it('signs an ES256 provider token APNs can verify', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const jwt = apnsJwt('KEY1234567', '5R2JL527Z3', pem, 1_700_000_000_000);
    const [h, b, s] = jwt.split('.');
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({ alg: 'ES256', kid: 'KEY1234567' });
    expect(JSON.parse(Buffer.from(b, 'base64url').toString())).toEqual({ iss: '5R2JL527Z3', iat: 1_700_000_000 });
    expect(verify('sha256', Buffer.from(`${h}.${b}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'))).toBe(true);
  });

  it('registers under the recovery code and hands each token out once, only to the same key', async () => {
    expect((await PUT(req('PUT', { slot: SLOT, token: 'ab'.repeat(32) }), { params })).status).toBe(204);
    expect(await liveEnd()!.take(ID, 'wrong', SLOT)).toEqual([]);
    // No APNs key here: the end is accepted and nothing is sent.
    expect((await POST(req('POST', { slot: SLOT }), { params })).status).toBe(204);
    expect(await liveEnd()!.take(ID, (await import('../src/lib/backups')).keyHash(KEY), SLOT)).toEqual([]);
  });

  it('refuses a bad slot, token or key', async () => {
    expect((await PUT(req('PUT', { slot: 'x', token: 'ab'.repeat(32) }), { params })).status).toBe(422);
    expect((await PUT(req('PUT', { slot: SLOT, token: 'not-hex' }), { params })).status).toBe(422);
    expect((await POST(req('POST', { slot: SLOT }, 'short'), { params })).status).toBe(404);
  });
});
