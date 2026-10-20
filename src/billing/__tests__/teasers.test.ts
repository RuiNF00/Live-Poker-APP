import assert from 'node:assert/strict';
import test from 'node:test';

import { teaserMoment } from '../moments';
import { teasers, teaserText } from '../teasers';
import type { Session } from '@/store/types';

const H = 3_600_000;
const DAY = 86_400_000;
function session(i: number, venue: string, result: number, currency = '€'): Session {
  // Same weekday and hour for all, so only the venue differs.
  const start = Date.UTC(2026, 0, 5) + i * 7 * DAY + 20 * H;
  return { id: 's' + i, kind: 'cash', name: '2/5', venue, currency, startedAt: start, endedAt: start + 5 * H, breaks: [], buyIn: 1000, entries: 1, addOn: 0, cashOut: 1000 + result } as unknown as Session;
}

test('a venue gap becomes a line without the venue or the amount', () => {
  const list = [...Array.from({ length: 6 }, (_, i) => session(i, 'Sala do Rio', 600)), ...Array.from({ length: 6 }, (_, i) => session(10 + i, 'Clube Central', -300))];
  const found = teasers(list, '€');
  const venue = found.find((x) => x.id === 'venue');
  assert.ok(venue);
  assert.equal(venue.text, 'Há uma sala onde perdes dinheiro.');
  for (const x of found) assert.doesNotMatch(x.text, /Rio|Central|\d/);
});

test('other currencies and open sessions are left out, and too little data says nothing', () => {
  const list = [...Array.from({ length: 6 }, (_, i) => session(i, 'Sala do Rio', 600, '$')), ...Array.from({ length: 6 }, (_, i) => session(10 + i, 'Clube Central', -300, '$'))];
  assert.deepEqual(teasers(list, '€'), []);
  assert.deepEqual(teasers(list.slice(0, 4), '$'), []);
});

test('gains only: the line says where it pays more, not that it loses', () => {
  assert.equal(teaserText({ id: 'venue', tone: 'good', groups: [{ label: 'a', sessions: 5, hours: 20, profit: 10, rate: 1 }] }), 'Há uma sala onde rendes claramente mais.');
  assert.equal(teaserText({ id: 'stakes', tone: 'bad', groups: [{ label: 'a', sessions: 5, hours: 20, profit: -10, rate: -1 }] }), 'Há uma stake onde perdes dinheiro.');
});

test('the home moment is the strongest finding, once per finding and direction', () => {
  assert.equal(teaserMoment([], 12), null);
  const m = teaserMoment([{ id: 'venue', tone: 'bad', text: 'Há uma sala onde perdes dinheiro.' }, { id: 'weekday', tone: 'good', text: 'x' }], 12);
  assert.deepEqual(m, { kind: 'teaser', key: 'teaser:venue:bad', text: 'Há uma sala onde perdes dinheiro.', sessions: 12 });
});

test('every teaser line is translated (they are returned, not passed to t(), so the i18n scan misses them)', async () => {
  const { default: en } = await import('@/i18n/en');
  const { default: es } = await import('@/i18n/es');
  const ids = ['venue', 'stakes', 'weekday', 'daytime', 'length', 'tilt', 'tiltNext', 'sleep', 'energy', 'focus'] as const;
  for (const id of ids)
    for (const rate of [1, -1]) {
      const text = teaserText({ id, tone: 'good', groups: [{ label: 'a', sessions: 5, hours: 20, profit: rate, rate }] });
      assert.ok(en[text], `en: ${text}`);
      assert.ok(es[text], `es: ${text}`);
    }
});
