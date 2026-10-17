/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parsePaywallConfig } from '../experiments';
import { addBlocked, sessionEndCard } from '../session-limit';
import { DEFER_DAYS, ENDED_DAYS, sessionStartOffer, trialNotice } from '../trial-moments';

const DAY = 86_400_000;
const now = 1_800_000_000_000;

test('a deferred trial is offered once, at a live session, while it can still start', () => {
  const s = { at: now - DAY };
  assert.equal(sessionStartOffer(s, { isPro: false, trialDays: 7, now }), true);
  assert.equal(sessionStartOffer(null, { isPro: false, trialDays: 7, now }), false);
  assert.equal(sessionStartOffer({ ...s, shown: now - 1 }, { isPro: false, trialDays: 7, now }), false);
  assert.equal(sessionStartOffer(s, { isPro: true, trialDays: 7, now }), false);
  assert.equal(sessionStartOffer(s, { isPro: false, trialDays: 0, now }), false);
  assert.equal(sessionStartOffer({ at: now - (DEFER_DAYS + 1) * DAY }, { isPro: false, trialDays: 14, now }), false);
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

test('offering copy in pt-BR and es, pt-BR falling back to pt; defer only when set to true', () => {
  const copy = { plan: { title: { pt: 'Olá PT', 'pt-BR': 'Olá BR', es: 'Hola' } }, generic: { title: { pt: 'Só PT' } } };
  assert.equal(parsePaywallConfig('x', { copy }, 'pt-BR').copy.plan?.title, 'Olá BR');
  assert.equal(parsePaywallConfig('x', { copy }, 'pt-BR').copy.generic?.title, 'Só PT');
  assert.equal(parsePaywallConfig('x', { copy }, 'es').copy.plan?.title, 'Hola');
  assert.equal(parsePaywallConfig('x', { copy }, 'es').copy.generic, undefined);
  assert.equal(parsePaywallConfig('x', { defer: true }, 'pt').defer, true);
  assert.equal(parsePaywallConfig('x', { defer: 'yes' }, 'pt').defer, false);
  assert.equal(parsePaywallConfig('x', null, 'pt').defer, false);
});
