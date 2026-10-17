/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_PAYWALL, parsePaywallConfig } from '../experiments';
import { freeVsPro, FREE } from '../plans';

test('no metadata: the app paywall as it is', () => {
  assert.deepEqual(parsePaywallConfig('default', {}, 'pt'), DEFAULT_PAYWALL);
  assert.deepEqual(parsePaywallConfig('', null, 'en'), DEFAULT_PAYWALL);
});

test('layout and headline in the player language', () => {
  const c = parsePaywallConfig('table_test', { layout: 'table', copy: { generic: { title: { pt: 'Joga com dados', en: 'Play with data' } } } }, 'en');
  assert.equal(c.offering, 'table_test');
  assert.equal(c.layout, 'table');
  assert.deepEqual(c.copy.generic, { title: 'Play with data' });
});

test('unknown layout, wrong types and long text are ignored', () => {
  const c = parsePaywallConfig('x', { layout: 'carousel', copy: { hands: { title: { pt: 'a'.repeat(61) }, body: 'not an object' }, plan: 3 } }, 'pt');
  assert.equal(c.layout, 'list');
  assert.deepEqual(c.copy, {});
});

test('the table follows the free limits', () => {
  const rows = freeVsPro();
  assert.equal(rows[0].free, String(FREE.handsPerDay));
  assert.ok(rows.every((r) => r.pro !== false));
});
