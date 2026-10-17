/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bigWin, pickMoment, reviewAfterBust, viewed, VIEWS_MIN } from '../moments';
import type { Session } from '@/store/types';

const DAY = 86_400_000;
const NOW = 100 * DAY;
const s = (id: string, endedAt: number, buyIn: number, cashOut: number, currency = '€') =>
  ({ id, kind: 'cash', currency, startedAt: endedAt - 3_600_000, endedAt, breaks: [], buyIn, entries: 1, addOn: 0, cashOut }) as unknown as Session;

test('the best session so far, still fresh, is a moment', () => {
  const m = bigWin([s('a', NOW - 10 * DAY, 500, 900), s('b', NOW - DAY, 500, 1500)], NOW);
  assert.equal(m?.kind, 'bigWin');
  assert.equal(m?.kind === 'bigWin' && m.profit, 1000);
});

test('not a moment: a loss, a smaller win, or old news', () => {
  assert.equal(bigWin([s('a', NOW - DAY, 500, 200)], NOW), null);
  assert.equal(bigWin([s('a', NOW - 10 * DAY, 500, 2000), s('b', NOW - DAY, 500, 900)], NOW), null);
  assert.equal(bigWin([s('a', NOW - 5 * DAY, 500, 900)], NOW), null);
});

test('other currencies are not compared', () => {
  assert.ok(bigWin([s('a', NOW - 10 * DAY, 0, 5000, '$'), s('b', NOW - DAY, 500, 900, '€')], NOW));
});

test('views: the most viewed hand past the minimum, with a new key at each doubling', () => {
  assert.equal(viewed([{ handId: 'h', views: VIEWS_MIN - 1 }]), null);
  const a = viewed([{ handId: 'x', views: 12 }, { handId: 'h', views: 37 }]);
  assert.equal(a?.kind === 'views' && a.handId, 'h');
  assert.equal(a?.key, 'views:h:20');
  assert.equal(viewed([{ handId: 'h', views: 45 }])?.key, 'views:h:40');
});

test('a dismissed moment stays gone; the next one shows', () => {
  const win = bigWin([s('b', NOW - DAY, 500, 1500)], NOW);
  const views = viewed([{ handId: 'h', views: 15 }]);
  assert.equal(pickMoment([win, views], [])?.kind, 'bigWin');
  assert.equal(pickMoment([win, views], [win!.key])?.kind, 'views');
  assert.equal(pickMoment([win, views], [win!.key, views!.key]), null);
});

test('after a losing session with hands, offer to review them; not after a win or with no hands', () => {
  const lost = s('l', NOW - 3_600_000, 1000, 0);
  const m = reviewAfterBust([lost], [{ id: 'b', sessionId: 'l', createdAt: 2 }, { id: 'a', sessionId: 'l', createdAt: 1 }, { id: 'x', createdAt: 0 }], NOW);
  assert.deepEqual(m, { kind: 'review', key: 'review:l', sessionId: 'l', hands: 2, firstHandId: 'a' });
  assert.equal(reviewAfterBust([lost], [], NOW), null);
  assert.equal(reviewAfterBust([s('w', NOW - 3_600_000, 100, 500)], [{ id: 'a', sessionId: 'w', createdAt: 1 }], NOW), null);
  assert.equal(reviewAfterBust([s('o', NOW - 2 * DAY, 1000, 0)], [{ id: 'a', sessionId: 'o', createdAt: 1 }], NOW), null);
});
