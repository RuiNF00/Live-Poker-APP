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

test('engines without TextDecoder read the same text, and a long file stays fast', () => {
  const samples = [
    new TextEncoder().encode('Data;Local;Lucro\n12/03/2024;São Paulo — Café “Ñ”;+120,50 €\n🂡 ok\n'.repeat(50)),
    new Uint8Array([0x53, 0xe3, 0x6f, 0x20, 0x50, 0x61, 0x75, 0x6c, 0x6f, 0x0a]), // Windows-1252 São Paulo
    new Uint8Array([0xef, 0xbb, 0xbf, 0x61, 0xc3, 0xa9, 0x0a]), // BOM + "aé"
    new Uint8Array([0x61, 0xed, 0xa0, 0x80, 0x62]), // a surrogate written as UTF-8: not UTF-8
    new Uint8Array([0x61, 0xc0, 0xaf]), // overlong: not UTF-8
  ];
  const withEngine = samples.map((b) => decodeText(b));
  const saved = globalThis.TextDecoder;
  // @ts-expect-error: an engine without one
  delete globalThis.TextDecoder;
  try {
    const own = samples.map((b) => decodeText(b));
    assert.deepEqual(own, withEngine);
    const big = new TextEncoder().encode('2024-01-01,Casino Lisboa,cash,100,250\n'.repeat(60000) + 'Café\n');
    const t = performance.now();
    assert.ok(decodeText(big).text.endsWith('Café\n'));
    assert.ok(performance.now() - t < 1000);
  } finally {
    globalThis.TextDecoder = saved;
  }
});

test('a TextDecoder that ignores strict mode never turns Windows-1252 into replacement marks', () => {
  const saved = globalThis.TextDecoder;
  class Loose {
    fatal = false;
    decode(b: Uint8Array) {
      return new saved('utf-8').decode(b);
    }
  }
  // @ts-expect-error: a stand-in engine decoder
  globalThis.TextDecoder = Loose;
  try {
    const r = decodeText(new Uint8Array([0x53, 0xe3, 0x6f, 0x20, 0x50, 0x61, 0x75, 0x6c, 0x6f]));
    assert.deepEqual(r, { text: 'São Paulo', encoding: 'windows-1252' });
  } finally {
    globalThis.TextDecoder = saved;
  }
});
