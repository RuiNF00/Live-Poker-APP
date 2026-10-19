/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { b64url, fromB64url, open, seal } from '../sealed-link';

const key = b64url(Uint8Array.from({ length: 32 }, (_, i) => i * 7));
const nonce = Uint8Array.from({ length: 12 }, (_, i) => i);

test('a sealed page opens with its key and id, and nothing else', () => {
  const data = { bk: 'João Ñuñez 🂡', bal: 1234.56 };
  const s = seal(data, 'AbCdEf1234', key, nonce);
  assert.deepEqual(open(s, 'AbCdEf1234', key), data);
  assert.equal(open(s, 'Other12345', key), null);
  assert.equal(open(s, 'AbCdEf1234', b64url(new Uint8Array(32))), null);
  // Nothing readable on the server side.
  assert.ok(!s.c.includes('Jo') && !JSON.stringify(s).includes('1234.56'));
});

test('base64url round trip at every length', () => {
  for (let n = 0; n < 40; n++) {
    const b = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n) & 255);
    assert.deepEqual(fromB64url(b64url(b)), b);
  }
  assert.equal(key.length, 43);
});
