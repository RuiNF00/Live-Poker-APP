/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { WHATS_NEW } from '../../data/whats-new';
import en from '../en';

test('every "Novidades" line has an English translation', () => {
  const missing = WHATS_NEW.flatMap((r) => r.items.flatMap((it) => [it.title, it.body])).filter((s) => !(s in en));
  assert.deepEqual(missing, []);
});
