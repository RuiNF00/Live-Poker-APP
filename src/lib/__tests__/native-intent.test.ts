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
