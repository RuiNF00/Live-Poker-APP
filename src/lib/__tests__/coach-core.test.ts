/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { canCreateLink, EMPTY_COACH, eraseJobs, handsCommented, linkStatus, markHandSeen, mergeComments, parseComments, syncable, unreadByHand, type CoachComment, type CoachLink, type CoachState } from '../coach-core';
import { KEEP_KEYS, keysToErase } from '../erase-core';

const link = (over: Partial<CoachLink> = {}): CoachLink => ({
  token: 'a'.repeat(32), ownerToken: 'b'.repeat(64), title: 'Rever com coach', url: 'https://sweatbook.poker/c/x', handIds: ['h1', 'h2'],
  createdAt: '2026-10-17T10:00:00.000Z', expiresAt: null, revokedAt: null, lastSync: null, ...over,
});
const c = (id: string, over: Partial<CoachComment> = {}): CoachComment => ({
  id, handId: 'h1', stepIndex: 4, mark: 'mistake', author: 'coach', name: 'Ana', body: 'Fold aqui.', createdAt: '2026-10-17T11:00:00.000Z', ...over,
});
const state = (over: Partial<CoachState> = {}): CoachState => ({ ...EMPTY_COACH, links: [link()], ...over });

test('new coach comments come in once, per hand, and move the sync cursor', () => {
  const tok = link().token;
  const a = mergeComments(state(), tok, [c('1'), c('2', { handId: 'h2', createdAt: '2026-10-17T12:00:00.000Z' }), c('3', { handId: 'not-mine' })]);
  assert.equal(a.fresh.length, 2);
  assert.equal(handsCommented(a.fresh), 2);
  assert.equal(a.state.links[0].lastSync, '2026-10-17T12:00:00.000Z');
  const b = mergeComments(a.state, tok, [c('1')]);
  assert.equal(b.fresh.length, 0, 'same comment twice is not new');
  assert.equal(b.state.comments[tok].length, 2);
});

test('a reply that comes back from the server replaces the copy waiting on the phone', () => {
  const tok = link().token;
  const s = state({ comments: { [tok]: [c('local-1', { author: 'player', mark: null, body: 'Porquê?', pending: true })] } });
  const m = mergeComments(s, tok, [c('srv-9', { author: 'player', mark: null, body: 'Porquê?' })]);
  assert.deepEqual(m.state.comments[tok].map((x) => x.id), ['srv-9']);
  assert.equal(m.fresh.length, 0, "the player's own reply never notifies");
});

test('unread counts clear when the hand is opened', () => {
  const tok = link().token;
  const s = state({ comments: { [tok]: [c('1'), c('2'), c('3', { handId: 'h2' }), c('4', { author: 'player' })] } });
  assert.deepEqual(unreadByHand(s), { h1: 2, h2: 1 });
  const seen = markHandSeen(s, 'h1');
  assert.deepEqual(unreadByHand(seen), { h2: 1 });
  assert.equal(markHandSeen(seen, 'h1'), seen, 'nothing new: same object, no write');
});

test('links: live, expired, revoked; closed for 30 days stop syncing; one free link', () => {
  const now = Date.parse('2026-10-17T12:00:00.000Z');
  assert.equal(linkStatus(link(), now), 'live');
  assert.equal(linkStatus(link({ expiresAt: '2026-10-17T11:00:00.000Z' }), now), 'expired');
  assert.equal(linkStatus(link({ revokedAt: '2026-10-17T11:00:00.000Z' }), now), 'revoked');
  const old = link({ token: 'c'.repeat(32), revokedAt: '2026-09-01T00:00:00.000Z' });
  const recent = link({ token: 'd'.repeat(32), revokedAt: '2026-10-10T00:00:00.000Z' });
  assert.deepEqual(syncable(state({ links: [link(), old, recent] }), now).map((l) => l.token[0]), ['a', 'd']);
  assert.equal(canCreateLink(false, false), true);
  assert.equal(canCreateLink(false, true), false);
  assert.equal(canCreateLink(true, true), true);
});

test('server JSON is checked before it reaches the phone', () => {
  const out = parseComments({ comments: [c('1', { mark: 'great' as never }), { id: 2 }, null, c('3', { author: 'admin' as never })] });
  assert.equal(out.length, 2);
  assert.equal(out[0].mark, null);
  assert.equal(out[1].author, 'coach');
  assert.deepEqual(parseComments(null), []);
});

test('"delete all my data" deletes every coaching link on the server, and keeps the free-link flag', () => {
  const jobs = eraseJobs(state({ links: [link(), link({ token: 'e'.repeat(32), revokedAt: '2026-10-01T00:00:00.000Z' })] }));
  assert.deepEqual(jobs.map((j) => [j.kind, j.key[0]]), [['coach-erase', 'a'], ['coach-erase', 'e']]);
  assert.equal(jobs[0].payload.ownerToken, 'b'.repeat(64));
  assert.ok(KEEP_KEYS.includes('rl.coach.free.v1'));
  assert.deepEqual(keysToErase(['rl.coach.v1', 'rl.coach.free.v1']), ['rl.coach.v1']);
});

test("the coach's step reads the same on the phone as on the web replayer", async () => {
  const { stepLabeller } = await import('../coach-steps');
  const { sampleHand } = await import('../../poker/sample');
  const label = stepLabeller(sampleHand('h1'), 'pt');
  assert.equal(label(0), 'Início da mão');
  assert.equal(label(7), 'Pré-flop · Hero Raise 6 BB');
  assert.equal(label(null), '');
  assert.equal(label(999), '');
});
