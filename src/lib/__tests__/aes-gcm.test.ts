/// <reference types="node" />
// The platform cipher (aes-gcm.ts) against @noble/ciphers, which wrote every backup
// and sealed link before it: the same bytes both ways, so nothing already stored
// changes. The phone's file (aes-gcm.native.ts) has the same contract and is checked
// on the device.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { gcm } from '@noble/ciphers/aes';
import { gunzipSync, strToU8 } from 'fflate';

import { deriveKeys, fromB64, seal as sealV1, sealAsync, unseal } from '../backup-crypto';
import { gcmDecrypt, gcmEncrypt } from '../aes-gcm';
import { b64url, fromB64url, open, seal } from '../sealed-link';

const key = Uint8Array.from({ length: 32 }, (_, i) => (i * 29 + 3) & 255);
const nonce = Uint8Array.from({ length: 12 }, (_, i) => i + 1);
const aad = strToU8('sweatbook-b:AbCdEf1234');
const sizes = [0, 1, 15, 16, 17, 1000, 70_000];
const data = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 131 + n) & 255);

test('same bytes as noble, with and without associated data, at every length', async () => {
  for (const n of sizes) {
    const d = data(n);
    assert.deepEqual(await gcmEncrypt(key, nonce, d), gcm(key, nonce).encrypt(d), `${n} bytes`);
    assert.deepEqual(await gcmEncrypt(key, nonce, d, aad), gcm(key, nonce, aad).encrypt(d), `${n} bytes, aad`);
  }
});

test('each opens what the other sealed', async () => {
  for (const n of sizes) {
    const d = data(n);
    assert.deepEqual(await gcmDecrypt(key, nonce, gcm(key, nonce, aad).encrypt(d), aad), d);
    assert.deepEqual(gcm(key, nonce, aad).decrypt(await gcmEncrypt(key, nonce, d, aad)), d);
  }
});

test('fails closed: a wrong key, nonce, associated data or one flipped bit throws', async () => {
  const c = await gcmEncrypt(key, nonce, data(100), aad);
  const flipped = c.slice();
  flipped[40] ^= 1;
  const tag = c.slice();
  tag[c.length - 1] ^= 1;
  await assert.rejects(gcmDecrypt(new Uint8Array(32), nonce, c, aad));
  await assert.rejects(gcmDecrypt(key, new Uint8Array(12), c, aad));
  await assert.rejects(gcmDecrypt(key, nonce, c, strToU8('sweatbook-b:Other12345')));
  await assert.rejects(gcmDecrypt(key, nonce, c));
  await assert.rejects(gcmDecrypt(key, nonce, flipped, aad));
  await assert.rejects(gcmDecrypt(key, nonce, tag, aad));
  await assert.rejects(gcmDecrypt(key, nonce, c.subarray(0, 15), aad));
});

test('backups: v1 and v2 written now open with noble, and ones noble wrote open now', async () => {
  const k = deriveKeys('ABCDEFGHJKMNPQRS').enc;
  const n = new Uint8Array(12).fill(7);
  const body = JSON.stringify({ app: 'sweatbook', v: 1, hands: [{ id: 'h', notes: 'Zé do boné €' }] });
  // v2: "SWB2", nonce, ciphertext + tag, inside a stored (level 0) gzip.
  const v2 = gunzipSync(await sealAsync(body, k, n, async () => {}));
  assert.equal(new TextDecoder().decode(gunzipSync(gcm(k, v2.subarray(4, 16)).decrypt(v2.subarray(16)))), body);
  // v1: JSON envelope, base64.
  const v1 = JSON.parse(await sealV1(body, k, n)) as { n: string; c: string };
  assert.equal(new TextDecoder().decode(gunzipSync(gcm(k, fromB64(v1.n)).decrypt(fromB64(v1.c)))), body);
  // What noble wrote before this change, rebuilt byte for byte, still opens.
  const { gzipSync } = await import('fflate');
  const zipped = gzipSync(strToU8(body));
  const ct = gcm(k, n).encrypt(zipped);
  const old = new Uint8Array(16 + ct.length);
  old.set([0x53, 0x57, 0x42, 0x32]);
  old.set(n, 4);
  old.set(ct, 16);
  assert.equal(await unseal(gzipSync(old, { level: 0 }), k, true), body);
});

test('sealed links: a page sealed now opens with noble, and one noble sealed opens now', async () => {
  const k = b64url(key);
  const page = { bk: 'João Ñuñez 🂡', bal: 1234.56 };
  const s = await seal(page, 'AbCdEf1234', k, nonce);
  const plain = gcm(key, fromB64url(s.n), strToU8('sweatbook-b:AbCdEf1234')).decrypt(fromB64url(s.c));
  assert.deepEqual(JSON.parse(new TextDecoder().decode(plain)), page);
  const byNoble = { v: 1 as const, n: b64url(nonce), c: b64url(gcm(key, nonce, strToU8('sweatbook-b:AbCdEf1234')).encrypt(strToU8(JSON.stringify(page)))) };
  assert.deepEqual(byNoble, s);
  assert.deepEqual(await open(byNoble, 'AbCdEf1234', k), page);
  assert.equal(await open(byNoble, 'Other12345', k), null);
});
