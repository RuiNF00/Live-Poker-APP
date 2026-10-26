/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { redirectSystemPath } from '../../app/+native-intent';

const K = 'a'.repeat(64);
const go = (path: string) => redirectSystemPath({ path, initial: true });

test('a swap link hands the invite and the token from the fragment to the screen', () => {
  assert.equal(go(`https://sweatbook.poker/swap/g/abc123?r=RUI1#i=${K}`), `/swap/g/abc123?r=RUI1&i=${K}`);
  assert.equal(go(`https://sweatbook.poker/swap/abc123#k=${K}`), `/swap/abc123?k=${K}`);
  assert.equal(go('https://sweatbook.poker/swap/g/abc123#i=nothex'), '/swap/g/abc123');
  assert.equal(go('https://sweatbook.poker/swap/g/abc123'), 'https://sweatbook.poker/swap/g/abc123');
});

test('the cloud copy QR opens the join screen with the code filled in, never joins by itself', () => {
  const code = '0123456789ABCDEFGHJKMNPQRS';
  assert.equal(go(`sweatbook://sync#${code}`), `/devices?code=${code}`);
  assert.equal(go(`sweatbook:///sync#${code}`), `/devices?code=${code}`);
  assert.equal(go(`/sync#${code}`), `/devices?code=${code}`);
  // Typed by hand: dashes and lower case read as the same code.
  assert.equal(go('sweatbook://sync#01234-56789-abcdefghjkmnpqrs'), `/devices?code=${code}`);
  // Not a code: the empty join screen, nothing filled in.
  assert.equal(go('sweatbook://sync#ZZZZZZZZZZZZZZZZZZZZZZZZZUU'), '/devices?join=1');
  assert.equal(go('sweatbook://sync#short'), 'sweatbook://sync#short');
});
