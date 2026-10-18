/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decodeText } from '../decode';

const bytes = (...xs: number[]) => new Uint8Array(xs);
const utf16le = (s: string, bom: boolean) => {
  const out = bom ? [0xff, 0xfe] : [];
  for (const ch of s) out.push(ch.charCodeAt(0) & 0xff, ch.charCodeAt(0) >> 8);
  return new Uint8Array(out);
};

test('UTF-8 with and without a BOM', () => {
  const s = 'Data;Local\nSão Paulo;€';
  const plain = new Uint8Array(Buffer.from(s, 'utf8'));
  assert.deepEqual(decodeText(plain), { text: s, encoding: 'utf-8' });
  assert.deepEqual(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...plain])), { text: s, encoding: 'utf-8' });
});

test('Windows-1252 from Excel keeps accents and the euro sign', () => {
  // "São;€5"
  assert.deepEqual(decodeText(bytes(0x53, 0xe3, 0x6f, 0x3b, 0x80, 0x35)), { text: 'São;€5', encoding: 'windows-1252' });
});

test('UTF-16 little-endian, with a BOM and without one', () => {
  const s = 'Date\tVenue\tBuy-in\n2025-02-03\tSão Paulo\t100';
  assert.deepEqual(decodeText(utf16le(s, true)), { text: s, encoding: 'utf-16le' });
  assert.deepEqual(decodeText(utf16le(s, false)), { text: s, encoding: 'utf-16le' });
});

test('UTF-16 big-endian with a BOM', () => {
  assert.deepEqual(decodeText(bytes(0xfe, 0xff, 0x00, 0x41, 0x20, 0xac)), { text: 'A€', encoding: 'utf-16be' });
});

test('a large file decodes without overflowing the stack', () => {
  const s = 'é'.repeat(300000);
  assert.equal(decodeText(new Uint8Array(Buffer.from(s, 'utf8'))).text, s);
  assert.equal(decodeText(utf16le(s, true)).text, s);
});
