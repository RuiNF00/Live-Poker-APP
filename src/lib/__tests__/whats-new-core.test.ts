import assert from 'node:assert/strict';
import { test } from 'node:test';

import { whatsNewStep } from '../whats-new-core';

const D = 86_400_000;

test('a fresh install never shows the card', () => {
  assert.deepEqual(whatsNewStep(null, '1.1.0', true, false, 0), { show: false, next: { version: '1.1.0' } });
});

test('an update with an entry shows it once, for 7 days at most', () => {
  const first = whatsNewStep({ version: '1.0.0' }, '1.1.0', true, true, 0);
  assert.equal(first.show, true);
  const again = whatsNewStep(first.next, '1.1.0', true, true, 3 * D);
  assert.deepEqual(again, { show: true, next: null });
  assert.deepEqual(whatsNewStep(first.next, '1.1.0', true, true, 7 * D), { show: false, next: { version: '1.1.0' } });
});

test('dismissed, or an update with nothing new: no card', () => {
  assert.equal(whatsNewStep({ version: '1.1.0' }, '1.1.0', true, true, 0).show, false);
  assert.deepEqual(whatsNewStep({ version: '1.0.0' }, '1.0.1', false, true, 0), { show: false, next: { version: '1.0.1' } });
});

test('an existing player from before the card existed sees it', () => {
  assert.equal(whatsNewStep(null, '1.1.0', true, true, 0).show, true);
});
