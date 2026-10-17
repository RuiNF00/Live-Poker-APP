/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { atHour, chargeNoticeAt, planNudges, type NudgeInput } from '../nudges';

const DAY = 86_400_000;
const start = new Date(2026, 9, 17, 21, 30).getTime();
const trial = { start, end: start + 7 * DAY, willRenew: true };
const base: NudgeInput = {
  now: start + 60_000,
  isPro: true,
  trial,
  annualPrice: '199,99 US$',
  store: 'App Store',
  hands: [{ createdAt: start - DAY }, { createdAt: start + DAY }, { createdAt: start + 2 * DAY }],
  sessions: [{ startedAt: start + DAY }],
  sessionActive: false,
};
const byId = (p: NudgeInput) => Object.fromEntries(planNudges(p).map((n) => [n.id, n]));

test('day 5 of the trial, at midday, with what was logged since it started', () => {
  const d5 = byId(base)['trial-day5'];
  assert.equal(d5.at, new Date(2026, 9, 21, 13).getTime());
  assert.match(d5.body, /^2 mãos e 1 sessão registadas\. Grátis até /);
});

test('charge notice more than 24 h before the end, in waking hours', () => {
  const end = byId(base)['trial-end'];
  assert.ok(end.at < trial.end - DAY && end.at > byId(base)['trial-day5'].at);
  const h = new Date(end.at).getHours();
  assert.ok(h >= 9 && h < 22);
  assert.match(end.body, /199,99 US\$ por ano.*App Store/);
  // Ends at 03:00: 48 h before is 03:00, moved to 10:00 that day (still 41 h ahead).
  const early = new Date(2026, 9, 24, 3).getTime();
  assert.equal(chargeNoticeAt(early), atHour(early - 2 * DAY, 10));
});

test('no charge notice once the trial was cancelled, none outside a trial', () => {
  assert.equal(byId({ ...base, trial: { ...trial, willRenew: false } })['trial-end'], undefined);
  assert.equal(byId({ ...base, isPro: false })['trial-day5'], undefined);
  assert.equal(byId({ ...base, trial: null })['trial-end'], undefined);
});

test('past trial moments are not rescheduled', () => {
  const late = byId({ ...base, now: start + 5 * DAY + 20 * 3_600_000 });
  assert.equal(late['trial-day5'], undefined);
  assert.equal(late['trial-end'], undefined);
});

test('come-back nudge 4 days out, only with something logged and no session running', () => {
  const free = { ...base, isPro: false, trial: null };
  assert.equal(byId(free).comeback.at, new Date(2026, 9, 21, 13).getTime());
  assert.equal(byId({ ...free, hands: [], sessions: [] }).comeback, undefined);
  assert.equal(byId({ ...free, sessionActive: true }).comeback, undefined);
  // Lands on the same day as the day-5 reminder: that one already brings them back.
  assert.equal(byId(base).comeback, undefined);
});
