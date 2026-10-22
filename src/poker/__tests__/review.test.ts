/// <reference types="node" />
// "Rever": the review queue, its tie-in with "Rever com coach"-style folders,
// and the note staying on the phone when a hand is shared.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { publicHand } from '../privacy';
import { clearReview, fileInFolder, isReviewFolder, markPending, markReviewed, needsReview, reviewQueue } from '../review';
import type { Hand } from '../types';

const base: Hand = {
  v: 1, id: 'h', createdAt: 0, updatedAt: 0,
  game: { kind: 'cash', name: 'Casino', sb: 1, bb: 2, ante: 0, anteType: 'none', currency: '€' },
  players: [{ name: 'Hero', stack: 200 }, { name: 'Zé', stack: 200 }],
  button: 0, hero: 0, actions: [], board: [], tags: [], notes: '',
};

test('marking for review and reviewed, with a note', () => {
  assert.equal(needsReview(base), false);
  const p = markPending(base);
  assert.equal(needsReview(p), true);
  const r = markReviewed(p, '  Overfolded the river vs this reg  ', 1234);
  assert.equal(needsReview(r), false);
  assert.equal(r.review, 'reviewed');
  assert.equal(r.reviewedAt, 1234);
  assert.equal(r.reviewNote, 'Overfolded the river vs this reg');
  assert.equal(markReviewed(p, '   ').reviewNote, undefined, 'an empty note is no note');
  assert.equal(markPending(r).reviewedAt, undefined, 'back in the queue');
  assert.equal(markPending(r).reviewNote, 'Overfolded the river vs this reg', 'the note stays');
});

test('a hand in a "Rever com coach" folder is in the queue until reviewed', () => {
  assert.ok(isReviewFolder('Rever com coach'));
  assert.ok(isReviewFolder('review with Gil'));
  assert.equal(isReviewFolder('Bluffs'), false);
  const filed = fileInFolder(base, 'Rever com coach', true);
  assert.deepEqual(filed.folders, ['Rever com coach']);
  assert.equal(filed.review, 'pending');
  assert.equal(needsReview({ ...base, folders: ['Rever com coach'] }), true, 'older hands filed before this change count too');
  const done = markReviewed(filed);
  assert.equal(needsReview(done), false);
  assert.deepEqual(done.folders, ['Rever com coach'], 'reviewing never empties the folder');
  assert.equal(fileInFolder(done, 'Rever com coach', true).review, 'pending', 'filing it again asks for another look');
  assert.equal(fileInFolder(base, 'Bluffs', true).review, undefined, 'other folders leave the queue alone');
  assert.equal(fileInFolder(filed, 'Rever com coach', false).folders?.length, 0);
});

test('taking a hand out of the queue clears the state and the review folders', () => {
  const h = clearReview(fileInFolder(fileInFolder(base, 'Bluffs', true), 'Rever com coach', true));
  assert.equal(needsReview(h), false);
  assert.deepEqual(h.folders, ['Bluffs']);
});

test('review state and note never leave the phone', () => {
  const shared = publicHand(markReviewed(markPending(base), 'private'));
  assert.equal('review' in shared, false);
  assert.equal('reviewNote' in shared, false);
  assert.equal('reviewedAt' in shared, false);
});

test('a hand sent to a coach through a coaching link waits for review too', () => {
  const sent = new Set(['h']);
  assert.equal(needsReview(base, sent), true);
  assert.equal(needsReview(base, new Set(['other'])), false);
  assert.equal(needsReview(markReviewed(base), sent), false, 'until you mark it reviewed');
});

test('the "Rever" tag tapped at the table puts the hand in the queue; taking it out removes the tag', () => {
  const tagged = { ...base, tags: ['Bluff', 'Rever'] };
  assert.equal(needsReview(tagged), true);
  assert.equal(needsReview(markReviewed(tagged)), false, 'reviewed wins over the tag');
  assert.equal(needsReview(markPending(markReviewed(tagged))), true);
  const out = clearReview(tagged);
  assert.equal(needsReview(out), false);
  assert.deepEqual(out.tags, ['Bluff'], 'the other tags stay');
});

test('review queue: oldest first, of one session or of all', () => {
  const hands = [
    { ...base, id: 'c', createdAt: 30, sessionId: 's1', review: 'pending' as const },
    { ...base, id: 'a', createdAt: 10, sessionId: 's1', tags: ['Rever'] },
    { ...base, id: 'b', createdAt: 20, sessionId: 's2', review: 'pending' as const },
    { ...base, id: 'd', createdAt: 5, sessionId: 's1' },
    { ...base, id: 'e', createdAt: 1, sessionId: 's1', review: 'reviewed' as const, tags: ['Rever'] },
  ];
  assert.deepEqual(reviewQueue(hands, 's1').map((h) => h.id), ['a', 'c']);
  assert.deepEqual(reviewQueue(hands).map((h) => h.id), ['a', 'b', 'c']);
  assert.deepEqual(reviewQueue(hands, 's3'), []);
});
