/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { deriveKeys, fromB64, seal, sealAsync, toB64, unseal, unsealAsync } from '../backup-crypto';

const enc = (s: string) => new TextEncoder().encode(s);

test('base64 round trip at every padding length', () => {
  for (const s of ['', 'a', 'ab', 'abc', 'abcd', 'Sweatbook €']) {
    const b = enc(s);
    assert.equal(toB64(b), Buffer.from(b).toString('base64'));
    assert.deepEqual([...fromB64(toB64(b))], [...b]);
  }
});

test('keys are deterministic, case-insensitive and the auth key looks like a secret', () => {
  const a = deriveKeys('ABCDEFGHJKMNPQRS');
  const b = deriveKeys('abcdefghjkmnpqrs');
  assert.equal(a.auth, b.auth);
  assert.match(a.auth, /^[0-9A-HJKMNP-TV-Z]{16}$/);
  assert.notEqual(a.auth, 'ABCDEFGHJKMNPQRS');
  assert.equal(a.enc.length, 32);
});

test('seal/unseal round trip; the server copy has no plaintext; wrong key fails', () => {
  const { enc: key } = deriveKeys('ABCDEFGHJKMNPQRS');
  const body = JSON.stringify({ app: 'sweatbook', v: 1, hands: [{ id: 'h', notes: 'Zé do boné' }] });
  const sealed = seal(body, key, new Uint8Array(12).fill(7));
  assert.ok(!sealed.includes('Zé'));
  assert.equal(unseal(enc(sealed), key), body);
  assert.throws(() => unseal(enc(sealed), deriveKeys('ZZZZZZZZZZZZZZZZ').enc), /forbidden/);
});

test('older plain backups still open', () => {
  const body = '{"app":"sweatbook","v":1}';
  assert.equal(unseal(enc(body), new Uint8Array(32)), body);
});

test('sealAsync opens like seal, gzips in slices and never runs one slice too long', async () => {
  const { enc: key } = deriveKeys('ABCDEFGHJKMNPQRS');
  const { bigHistory } = await import('../../store/__tests__/fake-storage');
  const big = JSON.stringify({ app: 'sweatbook', v: 1, hands: bigHistory(600) });
  for (const body of ['', '{"app":"sweatbook","v":1}', big]) {
    let pauses = 0;
    let worst = 0;
    let since = performance.now();
    const sealed = await sealAsync(body, key, new Uint8Array(12).fill(3), async () => {
      worst = Math.max(worst, performance.now() - since);
      pauses++;
      await new Promise((r) => setTimeout(r, 0));
      since = performance.now();
    });
    assert.equal(unseal(sealed, key), body);
    assert.equal(pauses, Math.max(0, Math.ceil(new TextEncoder().encode(body).length / 32768) - 1));
    assert.ok(worst < 200, `slice took ${worst} ms`);
  }
});

test('unsealAsync opens everything unseal opens, in short slices', async () => {
  const { gzipSync } = await import('fflate');
  const { enc: key } = deriveKeys('ABCDEFGHJKMNPQRS');
  const { bigHistory } = await import('../../store/__tests__/fake-storage');
  const big = JSON.stringify({ app: 'sweatbook', v: 1, hands: bigHistory(600) });
  const inputs = ['', '{"app":"sweatbook","v":1}', big].flatMap((body) => {
    const sealed = enc(seal(body, key, new Uint8Array(12).fill(5)));
    return [sealed, gzipSync(sealed), enc(body)]; // as stored, gzipped in transit, an older plain copy
  });
  for (const raw of inputs) {
    let worst = 0;
    let since = performance.now();
    const out = await unsealAsync(raw, key, async () => {
      worst = Math.max(worst, performance.now() - since);
      await new Promise((r) => setTimeout(r, 0));
      since = performance.now();
    });
    assert.equal(out, unseal(raw, key));
    assert.ok(worst < 200, `slice took ${worst} ms`);
  }
  await assert.rejects(unsealAsync(enc(seal(big, key, new Uint8Array(12))), deriveKeys('ZZZZZZZZZZZZZZZZ').enc), /forbidden/);
});

test('v2 (what the app sends) is a gzip the server accepts, has no plaintext, and is smaller than v1 (no base64)', async () => {
  const { enc: key } = deriveKeys('ABCDEFGHJKMNPQRS');
  const { bigHistory } = await import('../../store/__tests__/fake-storage');
  const body = JSON.stringify({ app: 'sweatbook', v: 1, hands: bigHistory(600), notes: 'Zé do boné' });
  const v2 = await sealAsync(body, key, new Uint8Array(12).fill(9), async () => {});
  const v1 = enc(seal(body, key, new Uint8Array(12).fill(9)));
  assert.deepEqual([v2[0], v2[1]], [0x1f, 0x8b], 'gzip magic: the server stores it as application/gzip');
  assert.ok(!Buffer.from(v2).includes(Buffer.from('Zé')) && !Buffer.from(v2).includes(Buffer.from('sweatbook')));
  assert.ok(v2.length < v1.length * 0.85, `${v2.length} vs ${v1.length}`);
  assert.equal(unseal(v2, key), body);
  assert.equal(await unsealAsync(v2, key, async () => {}), body);
  assert.throws(() => unseal(v2, deriveKeys('ZZZZZZZZZZZZZZZZ').enc), /forbidden/);
  await assert.rejects(unsealAsync(v2, deriveKeys('ZZZZZZZZZZZZZZZZ').enc, async () => {}), /forbidden/);
});

test('the notice before the server deletes an unused copy: a month before 18 months', async () => {
  const { expiryWarnAt, EXPIRY_WARN_MS } = await import('../cloud-guard');
  assert.equal(expiryWarnAt(null), null);
  assert.equal(expiryWarnAt({ lastAt: undefined }), null, 'nothing copied yet');
  assert.equal(expiryWarnAt({ lastAt: 1000 }), 1000 + EXPIRY_WARN_MS);
  assert.equal(Math.round(EXPIRY_WARN_MS / 86400000), 510);
});

test('the cloud copy only opens encrypted: a plain copy put on the server is refused', async () => {
  const key = deriveKeys('ABCDEFGHJKMNPQRS').enc;
  const plain = JSON.stringify({ app: 'sweatbook', v: 1, hands: [], sessions: [], players: [] });
  const raw = new TextEncoder().encode(plain);
  assert.throws(() => unseal(raw, key, true), /forbidden/);
  await assert.rejects(unsealAsync(raw, key, undefined, true), /forbidden/);
  await assert.rejects(unsealAsync(new TextEncoder().encode('not json'), key, undefined, true), /forbidden/);
  // Encrypted copies (v1 and v2) still open; a file imported by hand may still be plain.
  assert.equal(await unsealAsync(new TextEncoder().encode(seal(plain, key, new Uint8Array(12))), key, undefined, true), plain);
  assert.equal(await unsealAsync(await sealAsync(plain, key, new Uint8Array(12)), key, undefined, true), plain);
  assert.equal(unseal(raw, key), plain);
});
