/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { deriveKeys, fromB64, seal, toB64, unseal } from '../backup-crypto';

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
