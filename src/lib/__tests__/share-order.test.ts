import assert from 'node:assert/strict';
import { test } from 'node:test';

import { orderShare, type ShareKey } from '../share-order';

const opts = (keys: (ShareKey | undefined)[]) => keys.map((key, i) => ({ key, label: String(i) }));

test('puts every sheet in one order, extras after', () => {
  const out = orderShare(opts(['other', 'copy', undefined, 'x', 'instagram', 'whatsapp']), null);
  assert.deepEqual(out.map((o) => o.key), ['instagram', 'whatsapp', 'x', 'copy', 'other', undefined]);
});

test('the last one used comes first', () => {
  const out = orderShare(opts(['instagram', 'whatsapp', 'x', 'copy', 'other']), 'x');
  assert.deepEqual(out.map((o) => o.key), ['x', 'instagram', 'whatsapp', 'copy', 'other']);
});

test('a last one this sheet lacks changes nothing', () => {
  const out = orderShare(opts(['whatsapp', 'copy', 'other']), 'instagram');
  assert.deepEqual(out.map((o) => o.key), ['whatsapp', 'copy', 'other']);
});
