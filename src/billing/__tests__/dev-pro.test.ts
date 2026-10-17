/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEV_PRO_KEY, devProFrom, localProFrom } from '../dev-pro';

const on = { getItem: (k: string) => (k === DEV_PRO_KEY ? '1' : null) };

test('a production build ignores the flag', () => {
  assert.equal(devProFrom(false, undefined, on), false);
  assert.equal(devProFrom(false, '0', on), false);
});

test('dev and screenshot builds read it', () => {
  assert.equal(devProFrom(true, undefined, on), true);
  assert.equal(devProFrom(false, '1', on), true);
  assert.equal(devProFrom(true, undefined, { getItem: () => null }), false);
  assert.equal(devProFrom(true, undefined, undefined), false);
});

test('local Pro needs the flag and a build with no store key', () => {
  assert.equal(localProFrom(undefined, false), false);
  assert.equal(localProFrom('0', false), false);
  assert.equal(localProFrom('1', true), false);
  assert.equal(localProFrom('1', false), true);
});
