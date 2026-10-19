/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CLAIM_KEY, createInviteReward, inviteStatusFrom } from '../invite-reward';

function mem() {
  const m = new Map<string, string>();
  return { m, getItem: async (k: string) => m.get(k) ?? null, setItem: async (k: string, v: string) => void m.set(k, v) };
}

/** The /activate endpoint: offline throws, otherwise answers `booked`. */
function server() {
  const s = { online: false, booked: true, calls: 0 };
  const post = async () => {
    if (!s.online) throw new TypeError('Network request failed');
    s.calls++;
    return { booked: s.booked };
  };
  return { s, post };
}

test('QA P2: claim queued offline, first hand saved offline, reward turns on when the claim gets through', async () => {
  const kv = mem();
  const { s, post } = server();
  const r = createInviteReward(kv, post);

  // Card room, no signal: the claim sits in the outbox, the friend saves a hand.
  assert.equal(await r.handSaved(), 'none');
  assert.equal(s.calls, 0);

  // Signal back: the outbox sends the claim and the server accepts it.
  s.online = true;
  assert.equal(await r.claimAccepted('k7qx4mzp', 'ok'), 'granted');
  assert.equal(s.calls, 1);
  assert.deepEqual(JSON.parse(kv.m.get(CLAIM_KEY)!), { code: 'k7qx4mzp', result: 'ok', handSaved: true, activated: true });

  // A second hand doesn't book it again.
  assert.equal(await r.handSaved(), 'none');
  assert.equal(s.calls, 1);
});

test('booked:false and lost signal are retried until booked, then never again', async () => {
  const kv = mem();
  const { s, post } = server();
  const r = createInviteReward(kv, post);
  s.online = true;
  assert.equal(await r.claimAccepted('k7qx4mzp', 'ok'), 'none'); // no hand yet

  s.booked = false; // RevenueCat hasn't seen this user yet
  assert.equal(await r.handSaved(), 'not_yet');
  assert.equal(await r.pending(), true);

  s.online = false; // retry while offline
  assert.equal(await r.activate(), 'not_yet');

  s.online = true;
  s.booked = true;
  assert.equal(await r.activate(), 'granted');
  assert.equal(await r.pending(), false);
  assert.equal(await r.activate(), 'none');
  assert.equal(s.calls, 2);
});

test('no invite, or an already-used one: hands never call the server', async () => {
  const { s, post } = server();
  s.online = true;
  const r = createInviteReward(mem(), post);
  assert.equal(await r.handSaved(), 'none');
  assert.equal(await r.claimAccepted('k7qx4mzp', 'already'), 'none');
  assert.equal(await r.handSaved(), 'none');
  assert.equal(await r.pending(), false);
  assert.equal(s.calls, 0);
});

test('a claim saved by an older version (handSaved on the claim, no hand marker) still activates', async () => {
  const kv = mem();
  kv.m.set(CLAIM_KEY, JSON.stringify({ code: 'k7qx4mzp', result: 'ok', handSaved: true }));
  const { s, post } = server();
  s.online = true;
  const r = createInviteReward(kv, post);
  assert.equal(await r.pending(), true);
  assert.equal(await r.activate(), 'granted');
});

test('an invite status without a link is no status: the screen offers to try again', () => {
  assert.equal(inviteStatusFrom(null), null);
  assert.equal(inviteStatusFrom({ code: 'ABCD2345' }), null);
  assert.equal(inviteStatusFrom({ code: 'ABCD2345', url: '' }), null);
  assert.equal(inviteStatusFrom({ code: 'ABCD2345', url: 'javascript:alert(1)' }), null);
  assert.equal(inviteStatusFrom({ url: 'https://sweatbook.poker/r/ABCD2345' }), null);
  assert.deepEqual(inviteStatusFrom({ code: 'ABCD2345', url: 'https://sweatbook.poker/r/ABCD2345', invited: 2, activated: 'x', offer: { until: '2026-11-01T00:00:00Z' } }), {
    code: 'ABCD2345',
    url: 'https://sweatbook.poker/r/ABCD2345',
    invited: 2,
    activated: 0,
    discounts: 0,
    offer: { until: '2026-11-01T00:00:00Z', iosCode: null },
  });
});
