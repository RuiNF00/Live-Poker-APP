/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parsePaywallConfig } from '../experiments';
import { addBlocked, sessionEndCard } from '../session-limit';
import { ENDED_DAYS, inQuietHours, proEndNotice, sessionStartOffer, trialNotice } from '../trial-moments';

const DAY = 86_400_000;
const now = 1_800_000_000_000;

test('the trial is offered once at a live session, to a free player who can still start one', () => {
  assert.equal(sessionStartOffer(null, { isPro: false, trialDays: 3 }), true);
  assert.equal(sessionStartOffer({ at: now - DAY }, { isPro: false, trialDays: 3 }), true);
  assert.equal(sessionStartOffer({ at: now - DAY, shown: now - 1 }, { isPro: false, trialDays: 3 }), false);
  assert.equal(sessionStartOffer({ shown: now - 1 }, { isPro: false, trialDays: 3 }), false);
  assert.equal(sessionStartOffer(null, { isPro: true, trialDays: 3 }), false);
  assert.equal(sessionStartOffer(null, { isPro: false, trialDays: 0 }), false, 'trial already used');
});

test('the trial notice: cancelled while it runs, ended after, each once per trial', () => {
  const trial = { start: now - 3 * DAY, end: now + 4 * DAY, willRenew: true };
  assert.equal(trialNotice(trial, {}, { isPro: true, now }), null);
  const off = { ...trial, willRenew: false };
  assert.equal(trialNotice(off, {}, { isPro: true, now }), 'cancelled');
  assert.equal(trialNotice(off, { cancelled: off.start }, { isPro: true, now }), null);
  const later = now + 5 * DAY;
  assert.equal(trialNotice(off, { cancelled: off.start }, { isPro: false, now: later }), 'ended');
  assert.equal(trialNotice(off, { ended: off.start }, { isPro: false, now: later }), null);
  assert.equal(trialNotice(trial, {}, { isPro: true, now: later }), null, 'it renewed: paying, nothing to say');
  assert.equal(trialNotice(off, {}, { isPro: false, now: trial.end + (ENDED_DAYS + 1) * DAY }), null);
  assert.equal(trialNotice(null, {}, { isPro: false, now }), null);
});

test('blocked hands are counted once per hand and only the latest sessions are kept', () => {
  let all = addBlocked({}, 's1', 'h1');
  all = addBlocked(all, 's1', 'h1');
  all = addBlocked(all, 's1', 'h2');
  assert.deepEqual(all.s1, ['h1', 'h2']);
  for (let i = 0; i < 30; i++) all = addBlocked(all, `x${i}`, 'h');
  assert.equal(Object.keys(all).length, 20);
  assert.equal(all.s1, undefined);
  assert.deepEqual(addBlocked(all, 'x25', 'h9').x25, ['h', 'h9']);
});

test('the session-end card: blocked hands first, hourly rate for cash, never after a loss or for Pro', () => {
  const base = { isPro: false, profit: 120, blocked: 0, hours: 4, game: 'cash' as const };
  assert.deepEqual(sessionEndCard(base), { kind: 'rate' });
  assert.deepEqual(sessionEndCard({ ...base, blocked: 2 }), { kind: 'blocked', n: 2 });
  assert.equal(sessionEndCard({ ...base, profit: -50, blocked: 2 }), null);
  assert.equal(sessionEndCard({ ...base, isPro: true, blocked: 2 }), null);
  assert.equal(sessionEndCard({ ...base, game: 'mtt' }), null);
  assert.equal(sessionEndCard({ ...base, hours: 0.5 }), null);
});

test('offering copy in pt-BR and es, pt-BR falling back to pt; defer on unless set to false', () => {
  const copy = { plan: { title: { pt: 'Olá PT', 'pt-BR': 'Olá BR', es: 'Hola' } }, generic: { title: { pt: 'Só PT' } } };
  assert.equal(parsePaywallConfig('x', { copy }, 'pt-BR').copy.plan?.title, 'Olá BR');
  assert.equal(parsePaywallConfig('x', { copy }, 'pt-BR').copy.generic?.title, 'Só PT');
  assert.equal(parsePaywallConfig('x', { copy }, 'es').copy.plan?.title, 'Hola');
  assert.equal(parsePaywallConfig('x', { copy }, 'es').copy.generic, undefined);
  assert.equal(parsePaywallConfig('x', { defer: false }, 'pt').defer, false);
  assert.equal(parsePaywallConfig('x', { defer: 'no' }, 'pt').defer, true);
  assert.equal(parsePaywallConfig('x', null, 'pt').defer, true);
});

test('Pro that ends another way is said once, calmly, and never on top of the trial screen', () => {
  const ended = now - DAY;
  assert.equal(proEndNotice(ended, null, null, { isPro: false, now }), true, 'invite days or a cancelled subscription ran out');
  assert.equal(proEndNotice(ended, ended, null, { isPro: false, now }), false, 'once');
  assert.equal(proEndNotice(ended, null, null, { isPro: true, now }), false, 'Pro came back');
  assert.equal(proEndNotice(null, null, null, { isPro: false, now }), false);
  assert.equal(proEndNotice(now - (ENDED_DAYS + 1) * DAY, null, null, { isPro: false, now }), false, 'too long ago to bring up');
  assert.equal(proEndNotice(ended, null, ended - 2 * DAY, { isPro: false, now }), false, 'the trial just ran out: "O teu trial acabou" says it');
  assert.equal(proEndNotice(ended, null, ended - 200 * DAY, { isPro: false, now }), true, 'the trial became a subscription, later cancelled');
  const second = now - 2 * 3_600_000;
  assert.equal(proEndNotice(second, ended, null, { isPro: false, now }), true, 'a later end (Pro again, then gone) is said again');
});

test('the one-time screens wait out the quiet hours, 23:00 to 12:00', () => {
  assert.deepEqual(
    [0, 8, 11, 12, 18, 22, 23].map(inQuietHours),
    [true, true, true, false, false, false, true],
  );
});
