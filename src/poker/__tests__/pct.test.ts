/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decimalComma } from '../../i18n';
import { pct } from '../format';

test('percentages follow the app language', () => {
  const sep = decimalComma ? ',' : '.';
  assert.equal(pct(0.847, 1), `84${sep}7%`);
  assert.equal(pct(0.5), '50%');
  assert.equal(pct(0.267, 1), `26${sep}7%`);
});
