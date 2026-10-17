/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { pokerStarsText } from '@/poker/pokerstars';
import { sampleHand } from '@/poker/sample';

import { GTOW_UPLOADS_URL, gtowPayload } from '../gtow-core';

test('GTO Wizard gets finished hands in PokerStars format, unfinished ones counted out', () => {
  const done = sampleHand('sample');
  const half = { ...done, id: 'half', actions: done.actions.slice(0, 2) };
  const p = gtowPayload([done, half]);
  assert.equal(p.sent, 1);
  assert.equal(p.skipped, 1);
  assert.ok(p.text.startsWith(pokerStarsText(done).slice(0, 40)));
  assert.deepEqual(gtowPayload([half]), { text: '', sent: 0, skipped: 1 });
  assert.match(GTOW_UPLOADS_URL, /^https:\/\/app\.gtowizard\.com\//);
});
