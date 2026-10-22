/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { atHour, chargeNoticeAt, chargeNoticeDue, comebackSeen, NUDGE_IDS, NUDGE_KIND, planNudges, playNotices, usualStartHour, weekNotice, weekNoticeAt, type NudgeInput } from '../nudges';

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

test('no notification sells Pro: only the charge notice during a trial; old recap ids still cancelled', () => {
  assert.deepEqual(planNudges(base).map((n) => n.id).filter((id) => id !== 'comeback'), ['trial-end']);
  assert.ok(NUDGE_IDS.includes('trial-recap'));
});

test('Google Play charge notice says to cancel before that date', () => {
  assert.match(byId({ ...base, store: 'Google Play' })['trial-end'].body, /Google Play antes dessa data/);
});

test('charge notice more than 24 h before the end, in waking hours', () => {
  const end = byId(base)['trial-end'];
  assert.ok(end.at < trial.end - DAY);
  const h = new Date(end.at).getHours();
  assert.ok(h >= 9 && h < 22);
  assert.match(end.body, /199,99 US\$ por ano.*App Store/);
  // Ends at 03:00: 48 h before is 03:00, moved to 10:00 that day (still 41 h ahead).
  const early = new Date(2026, 9, 20, 3).getTime();
  assert.equal(chargeNoticeAt(early), atHour(early - 2 * DAY, 10));
});

test('no charge notice once the trial was cancelled, none outside a trial', () => {
  assert.equal(byId({ ...base, trial: { ...trial, willRenew: false } })['trial-end'], undefined);
  assert.equal(byId({ ...base, isPro: false })['trial-end'], undefined);
  assert.equal(byId({ ...base, trial: null })['trial-end'], undefined);
});

test('past trial moments are not rescheduled', () => {
  const late = byId({ ...base, now: start + 2 * DAY });
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
  assert.deepEqual(NUDGE_KIND, { 'trial-end': 'billing', comeback: 'tips', week: 'week', 'play-arrive': 'tips', 'play-log': 'tips' });
});

// The week's notice. Tuesday 13 Oct 2026, 20:00: that week's Sunday is the 18th.
const tue = new Date(2026, 9, 13, 20).getTime();
const mon = new Date(2026, 9, 12, 0).getTime();
const free: NudgeInput = { ...base, now: tue, isPro: false, trial: null, hands: [], sessions: [] };
const hand = (createdAt: number, more: Partial<NudgeInput['hands'][number]> = {}) => ({ id: String(createdAt), createdAt, tags: [] as string[], ...more });

test('week notice: this Sunday at 13:00, only for a week with something logged', () => {
  assert.equal(new Date(weekNoticeAt(tue)).getDay(), 0);
  assert.equal(weekNoticeAt(tue), new Date(2026, 9, 18, 13).getTime());
  assert.equal(weekNotice(free), null, 'nothing logged: no notice, it never chases someone who stopped');
  assert.equal(weekNotice({ ...free, hands: [hand(mon - 3_600_000)] }), null, 'last week does not count');
  const n = weekNotice({ ...free, hands: [hand(mon + 3_600_000)] })!;
  assert.equal(n.at, new Date(2026, 9, 18, 13).getTime());
  assert.equal(n.title, 'A tua semana no póquer');
  assert.equal(n.body, '1 mão esta semana. Toca para veres as tuas mãos.');
  assert.equal(n.url, 'sweatbook://hands');
  // Sunday after 13:00: this week's has passed, the next one is planned once something is logged next week.
  assert.equal(weekNotice({ ...free, now: new Date(2026, 9, 18, 14).getTime(), hands: [hand(mon + 3_600_000)] }), null);
});

test('week notice: hands waiting for review open the queue; never an amount', () => {
  const sessions = [{ id: 's', startedAt: mon + 3_600_000, endedAt: mon + 5 * 3_600_000 }, { id: 't', startedAt: tue - 4 * 3_600_000, endedAt: tue - 3_600_000 }];
  const hands = [hand(mon + 2 * 3_600_000, { tags: ['Rever'] }), hand(mon + 3 * 3_600_000, { review: 'pending' }), hand(mon + 4 * 3_600_000), hand(mon - 9 * 86_400_000, { review: 'pending' })];
  const n = weekNotice({ ...free, sessions, hands })!;
  assert.equal(n.body, '2 sessões e 3 mãos esta semana. Tens 3 mãos para rever: toca para começar.');
  assert.equal(n.url, 'sweatbook://hands?review=1');
  assert.doesNotMatch(n.body, /[€$]|\d+[.,]\d{2}|ganh|perd/i);
  const one = weekNotice({ ...free, sessions: [], hands: [hand(mon + 3_600_000, { review: 'pending' })] })!;
  assert.equal(one.body, '1 mão esta semana. Tens 1 mão para rever: toca para começar.');
  assert.equal(weekNotice({ ...free, hands: [hand(mon + 3_600_000, { review: 'reviewed', tags: ['Rever'] })] })!.url, 'sweatbook://hands', 'a reviewed hand is not waiting');
});

test('week notice: the streak once it is 2 weeks or more', () => {
  const hands = [hand(mon + 3_600_000)];
  assert.equal(weekNotice({ ...free, hands, streakWeeks: 1 })!.body, '1 mão esta semana. Toca para veres as tuas mãos.');
  assert.equal(weekNotice({ ...free, hands, streakWeeks: 5 })!.body, '1 mão esta semana. 5 semanas seguidas a registar.');
});

test('week notice: not on the 1st (month recap day), not during a session or a festival, one with the come-back nudge', () => {
  // Sunday 1 Nov 2026 is the month recap's day.
  const tueOct27 = new Date(2026, 9, 27, 20).getTime();
  assert.equal(new Date(weekNoticeAt(tueOct27)).getDate(), 1);
  assert.equal(weekNotice({ ...free, now: tueOct27, hands: [hand(tueOct27 - 3_600_000)] }), null);
  const p = { ...free, hands: [hand(mon + 3_600_000)] };
  assert.ok(byId(p).week);
  assert.equal(byId({ ...p, sessionActive: true }).week, undefined);
  const sunday = new Date(2026, 9, 18).toDateString();
  assert.equal(byId({ ...p, festivalAt: (ts) => new Date(ts).toDateString() === sunday }).week, undefined);
  // Opened Thursday: the come-back nudge would be Monday 13:00, a day after the week's notice. Only the week's goes.
  const thu = new Date(2026, 9, 15, 20).getTime();
  const planned = planNudges({ ...p, now: thu });
  assert.deepEqual(planned.map((x) => x.id), ['week']);
  // Opened Monday: the come-back nudge is Friday, far enough from Sunday: both.
  assert.deepEqual(planNudges({ ...p, now: mon + 3 * 3_600_000 }).map((x) => x.id).sort(), ['comeback', 'week']);
  assert.ok(NUDGE_IDS.includes('week'), 'cancelled and re-planned on every sync');
});

// «Quando voltas a jogar?» (before/after list, item 4): the day the player picked brings two notices about logging.
const dayOf = (y: number, m: number, d: number) => new Date(y, m, d).getTime();

test('play plan: «Chegaste à mesa?» on the day at the usual hour, «Jogaste ontem?» the next day at 13:00', () => {
  const sessions = [21, 20, 22].map((h, i) => ({ startedAt: new Date(2026, 9, 10 + i, h, 0).getTime(), endedAt: new Date(2026, 9, 10 + i, 23, 0).getTime() }));
  const now = new Date(2026, 9, 18, 2, 0).getTime();
  const n = playNotices({ day: dayOf(2026, 9, 23) }, sessions, now);
  assert.deepEqual(n.map((x) => x.id), ['play-arrive', 'play-log']);
  assert.equal(n[0].at, new Date(2026, 9, 23, 21, 0).getTime(), 'the median start of the last sessions');
  assert.equal(n[0].url, 'sweatbook://session');
  assert.equal(n[1].at, new Date(2026, 9, 24, 13, 0).getTime());
  assert.equal(n[1].url, 'sweatbook://bankroll?add=session');
  for (const x of n) {
    assert.doesNotMatch(x.title + x.body, /[€$]|\d+[.,]\d{2}|ganh|perd|joga hoje|vai jogar/i, 'about logging, never about going to play');
    assert.equal(NUDGE_KIND[x.id], 'tips', 'on the Lembretes switch');
    assert.ok(NUDGE_IDS.includes(x.id), 'cancelled on every sync');
  }
});

test('play plan: a session started that day ends it; a day already gone leaves only what is still ahead', () => {
  const day = dayOf(2026, 9, 23);
  assert.deepEqual(playNotices({ day }, [{ startedAt: new Date(2026, 9, 23, 20, 0).getTime() }], new Date(2026, 9, 23, 21, 0).getTime()), []);
  const late = playNotices({ day }, [], new Date(2026, 9, 23, 23, 0).getTime());
  assert.deepEqual(late.map((x) => x.id), ['play-log']);
  assert.deepEqual(playNotices({ day }, [], new Date(2026, 9, 25, 9, 0).getTime()), []);
  assert.deepEqual(playNotices(null, [], day), []);
});

test('usual start hour: the median of the last 10, kept between 12:00 and 22:00; 19:00 with nothing logged', () => {
  assert.equal(usualStartHour([]), 19);
  assert.equal(usualStartHour([{ startedAt: new Date(2026, 9, 1, 2, 0).getTime(), endedAt: 1 }]), 12);
  assert.equal(usualStartHour([{ startedAt: new Date(2026, 9, 1, 23, 30).getTime(), endedAt: 1 }]), 22);
  assert.equal(usualStartHour([{ startedAt: new Date(2026, 9, 1, 15, 0).getTime() }]), 19, 'a running session does not count');
});

test('play plan: in the plan, not during a session, and the come-back nudge steps aside near it', () => {
  const now = new Date(2026, 9, 18, 2, 0).getTime();
  const p: NudgeInput = { ...base, now, isPro: false, trial: null, plan: { day: dayOf(2026, 9, 22) } };
  const ids = planNudges(p).map((x) => x.id);
  assert.ok(ids.includes('play-arrive') && ids.includes('play-log'));
  assert.ok(!ids.includes('comeback'), 'the come-back nudge (4 days on, the 22nd) is within 2 days of the plan');
  assert.deepEqual(planNudges({ ...p, sessionActive: true }).filter((x) => x.id.startsWith('play-')), []);
});
