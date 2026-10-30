/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { endsNow } from '../ends-now';

test('a hand saves itself on the tap that ends it, never because it opened already over', () => {
  // New hand: not over on opening, then hero folds.
  assert.equal(endsNow(null, false), false);
  assert.equal(endsNow(false, true), true);
  // A draft reopened with hero's fold in it: over on opening, and still over after the first tap (a seat, a name).
  assert.equal(endsNow(null, true), false);
  assert.equal(endsNow(true, true), false);
  // Undo the fold, fold again: it ends again.
  assert.equal(endsNow(true, false), false);
  assert.equal(endsNow(false, true), true);
});
