/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { atHour, chargeNoticeAt, chargeNoticeDue, comebackSeen, NUDGE_KIND, planNudges, recapAt, type NudgeInput } from '../nudges';

const DAY = 86_400_000;
// A 3-day trial started at a live session on Saturday evening.
const start = new Date(2026, 9, 17, 21, 30).getTime();
const trial = { start, end: start + 3 * DAY, willRenew: true };
const ended = new Date(2026, 9, 18, 2, 0).getTime();
const base: NudgeInput = {
  now: start + 60_000,
  isPro: true,
  trial,
  annualPrice: '199,99 US$',
  store: 'App Store',
  hands: [{ createdAt: start - DAY }, { createdAt: start + 600_000, sessionId: 's1' }, { createdAt: start + 3_600_000, sessionId: 's1' }, { createdAt: start + DAY }],
  sessions: [{ id: 's1', startedAt: start - 600_000, endedAt: ended }],
  sessionActive: false,
};
const byId = (p: NudgeInput) => Object.fromEntries(planNudges(p).map((n) => [n.id, n]));

test('the day after the first session of the trial: what Pro kept from it', () => {
  const r = byId(base)['trial-recap'];
  assert.equal(r.at, new Date(2026, 9, 18, 13).getTime());
  assert.match(r.body, /^2 mãos, sem limite\. Grátis até /);
  // No session finished yet: nothing to recap.
  assert.equal(byId({ ...base, sessions: [{ id: 's1', startedAt: start }] })['trial-recap'], undefined);
  // Ends late at night: midday the next day.
  assert.equal(recapAt(new Date(2026, 9, 17, 23).getTime()), new Date(2026, 9, 18, 13).getTime());
});

test('Google Play charge notice says to cancel before that date', () => {
  assert.match(byId({ ...base, store: 'Google Play' })['trial-end'].body, /Google Play antes dessa data/);
});

test('charge notice more than 24 h before the end, in waking hours', () => {
  const end = byId(base)['trial-end'];
  assert.ok(end.at < trial.end - DAY && Math.abs(end.at - byId(base)['trial-recap'].at) >= 6 * 3_600_000);
  const h = new Date(end.at).getHours();
  assert.ok(h >= 9 && h < 22);
  assert.match(end.body, /199,99 US\$ por ano.*App Store/);
  // Ends at 03:00: 48 h before is 03:00, moved to 10:00 that day (still 41 h ahead).
  const early = new Date(2026, 9, 20, 3).getTime();
  assert.equal(chargeNoticeAt(early), atHour(early - 2 * DAY, 10));
});

test('no charge notice once the trial was cancelled, none outside a trial', () => {
  assert.equal(byId({ ...base, trial: { ...trial, willRenew: false } })['trial-end'], undefined);
  assert.equal(byId({ ...base, isPro: false })['trial-recap'], undefined);
  assert.equal(byId({ ...base, trial: null })['trial-end'], undefined);
});

test('past trial moments are not rescheduled', () => {
  const late = byId({ ...base, now: start + 2 * DAY });
  assert.equal(late['trial-recap'], undefined);
  assert.equal(late['trial-end'], undefined);
});

test('come-back nudge 4 days out, only with something logged and no session running', () => {
  const free = { ...base, isPro: false, trial: null };
  assert.equal(byId(free).comeback.at, new Date(2026, 9, 21, 13).getTime());
  assert.equal(byId({ ...free, hands: [], sessions: [] }).comeback, undefined);
  assert.equal(byId({ ...free, sessionActive: true }).comeback, undefined);
});

test('come-back nudge: at most one every 14 days, none after 2 unanswered, none during a festival', () => {
  const free = { ...base, isPro: false, trial: null };
  const last = start - 5 * DAY;
  assert.equal(byId({ ...free, comeback: { last, ignored: 0 } }).comeback.at, atHour(last + 14 * DAY, 13));
  assert.equal(byId({ ...free, comeback: { ignored: 2 } }).comeback, undefined);
  assert.equal(byId({ ...free, festivalAt: () => true }).comeback, undefined);
  // It went off, and the player came back the next day: answered.
  assert.deepEqual(comebackSeen({ planned: start - DAY, ignored: 1 }, start), { last: start - DAY, ignored: 0 });
  // Came back a week after it went off: one more ignored.
  assert.deepEqual(comebackSeen({ planned: start - 7 * DAY, ignored: 1 }, start), { last: start - 7 * DAY, ignored: 2 });
  // Not due yet: nothing happened.
  assert.equal(comebackSeen({ planned: start + DAY, ignored: 0 }, start).ignored, 0);
});

test('in-app charge notice: same window as the notification, only without notifications', () => {
  const at = chargeNoticeAt(trial.end);
  assert.equal(chargeNoticeDue(trial, at, false), true);
  assert.equal(chargeNoticeDue(trial, at - 3_600_000, false), false);
  assert.equal(chargeNoticeDue(trial, at, true), false);
  assert.equal(chargeNoticeDue({ ...trial, willRenew: false }, at, false), false);
  assert.equal(chargeNoticeDue(trial, trial.end + 1, false), false);
});

test('only the notice before a charge is billing (always on); the rest are switchable tips', () => {
  assert.deepEqual(NUDGE_KIND, { 'trial-recap': 'tips', 'trial-end': 'billing', comeback: 'tips' });
});
