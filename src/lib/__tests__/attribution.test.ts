/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { festivalOn, linkSource } from '../attribution';
import { FESTIVALS, venueTime } from '@/poker/festivals';

test('each kind of link gets its source', () => {
  assert.equal(linkSource('hand', {}), 'shared_hand');
  assert.equal(linkSource('hand', { r: 'abc123' }), 'invite');
  // Hand links put the hand id in utm_campaign: not a campaign.
  assert.equal(linkSource('hand', { utm_campaign: 'h1' }), 'shared_hand');
  assert.equal(linkSource('invite', {}), 'invite');
  assert.equal(linkSource('invite', { utm_campaign: 'wsop-dec' }), 'utm_campaign');
  assert.equal(linkSource('swap', {}), 'swap');
  assert.equal(linkSource('backer', {}), 'backer_page');
});

test('festival_on is true during a shipped festival and false far from it', () => {
  const f = FESTIVALS[0];
  const mid = venueTime(f, f.events[Math.floor(f.events.length / 2)].start);
  assert.equal(festivalOn(mid), true);
  assert.equal(festivalOn(mid - 120 * 86_400_000), false);
});
