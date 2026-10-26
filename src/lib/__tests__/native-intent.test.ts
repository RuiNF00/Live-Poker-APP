/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { redirectSystemPath } from '../../app/+native-intent';
import { takeLinkedCode } from '../cloud-code';

const K = 'a'.repeat(64);
const go = (path: string) => redirectSystemPath({ path, initial: true });

test('a swap link hands the invite and the token from the fragment to the screen', () => {
  assert.equal(go(`https://sweatbook.poker/swap/g/abc123?r=RUI1#i=${K}`), `/swap/g/abc123?r=RUI1&i=${K}`);
  assert.equal(go(`https://sweatbook.poker/swap/abc123#k=${K}`), `/swap/abc123?k=${K}`);
  assert.equal(go('https://sweatbook.poker/swap/g/abc123#i=nothex'), '/swap/g/abc123');
  assert.equal(go('https://sweatbook.poker/swap/g/abc123'), 'https://sweatbook.poker/swap/g/abc123');
});

test('the cloud copy QR opens the join screen marked as a link, with the code in memory, never in the route', () => {
  const code = '0123456789ABCDEFGHJKMNPQRS';
  const want = { id: '0123456789', secret: 'ABCDEFGHJKMNPQRS' };
  for (const link of [`sweatbook://sync#${code}`, `sweatbook:///sync#${code}`, `/sync#${code}`, 'sweatbook://sync#01234-56789-abcdefghjkmnpqrs']) {
    const to = go(link);
    assert.equal(to, '/devices?from=link', link);
    assert.ok(!to.includes(code) && !to.includes(want.secret), link);
    assert.deepEqual(takeLinkedCode(), want, link);
    // Taken once: a later visit to the screen doesn't find it again.
    assert.equal(takeLinkedCode(), null, link);
  }
  // Not a code: the empty join screen, nothing kept.
  assert.equal(go('sweatbook://sync#ZZZZZZZZZZZZZZZZZZZZZZZZZUU'), '/devices?join=1');
  assert.equal(takeLinkedCode(), null);
  assert.equal(go('sweatbook://sync#short'), 'sweatbook://sync#short');
});
