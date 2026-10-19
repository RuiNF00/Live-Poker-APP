/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatCode, parseCode } from '../cloud-code';

test('code round trip, tolerant of case, spaces and look-alikes', () => {
  const c = { id: '0123456789', secret: 'ABCDEFGHJKMNPQRS' };
  const s = formatCode(c);
  assert.equal(s, '01234-56789-ABCDEFGHJKMNPQRS');
  assert.deepEqual(parseCode(s.toLowerCase().replace(/-/g, ' ')), c);
  assert.deepEqual(parseCode('o1234 56789 abcdefghjkmnpqrs'), c);
  assert.equal(parseCode('short'), null);
  assert.equal(parseCode('01234-56789-ABCDEFGHJKMNPQRU'), null);
});
