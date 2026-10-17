/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { canUse, pruneLog, remainingToday, usedToday, type UsageEvent } from '../limits';
import { annualSavingPct, perMonth, PLANS } from '../plans';

const day = (h: number, m = 0) => new Date(2026, 9, 17, h, m).getTime();
const yesterday = new Date(2026, 9, 16, 23, 59).getTime();

const log: UsageEvent[] = [
  { kind: 'hand', t: yesterday },
  { kind: 'hand', t: day(9) },
  { kind: 'hand', t: day(10) },
  { kind: 'share', t: day(10, 5) },
];

test('counts only today, per kind', () => {
  assert.equal(usedToday(log, 'hand', day(12)), 2);
  assert.equal(usedToday(log, 'share', day(12)), 1);
});

test('third hand allowed, fourth blocked for free users', () => {
  assert.equal(remainingToday(log, 'hand', 3, day(12)), 1);
  assert.equal(canUse(log, 'hand', 3, false, day(12)), true);
  const full = [...log, { kind: 'hand' as const, t: day(11) }];
  assert.equal(canUse(full, 'hand', 3, false, day(12)), false);
  assert.equal(remainingToday(full, 'hand', 3, day(12)), 0);
});

test('pro and unlimited always allowed', () => {
  const full = Array.from({ length: 10 }, (_, i) => ({ kind: 'hand' as const, t: day(1, i) }));
  assert.equal(canUse(full, 'hand', 3, true, day(12)), true);
  assert.equal(canUse(full, 'hand', null, false, day(12)), true);
  assert.equal(remainingToday(full, 'hand', null, day(12)), null);
});

test('limit resets at midnight', () => {
  const full = Array.from({ length: 3 }, (_, i) => ({ kind: 'hand' as const, t: day(20, i) }));
  const tomorrow = new Date(2026, 9, 18, 0, 1).getTime();
  assert.equal(canUse(full, 'hand', 3, false, tomorrow), true);
});

test('prune keeps today and yesterday only', () => {
  const old = [{ kind: 'hand' as const, t: new Date(2026, 9, 10).getTime() }, ...log];
  assert.equal(pruneLog(old, day(12)).length, log.length);
});

test('annual price math', () => {
  assert.equal(perMonth(PLANS.annual.price), 16.67);
  assert.equal(annualSavingPct(PLANS.monthly.price, PLANS.annual.price), 44);
});

test('welcome offer: once, after the first hand, only with a trial to give', async () => {
  const { shouldOfferWelcome } = await import('../offers');
  const base = { isPro: false, handsSaved: 1, shown: false, trialDays: 7, invited: false };
  assert.equal(shouldOfferWelcome(base), true);
  assert.equal(shouldOfferWelcome({ ...base, handsSaved: 0 }), false);
  assert.equal(shouldOfferWelcome({ ...base, shown: true }), false);
  assert.equal(shouldOfferWelcome({ ...base, isPro: true }), false);
  assert.equal(shouldOfferWelcome({ ...base, trialDays: 0 }), false);
  assert.equal(shouldOfferWelcome({ ...base, invited: true }), false);
});

test('paywall leads with the feature the player reached for', async () => {
  const { featuresFor, PRO_FEATURES } = await import('../plans');
  assert.equal(featuresFor('story')[0].feature.key, 'story');
  assert.equal(featuresFor('story')[0].highlight, true);
  assert.equal(featuresFor('welcome')[0].feature.key, 'hands');
  assert.equal(featuresFor('generic').filter((f) => f.highlight).length, 0);
  for (const r of ['hands', 'stats', 'story', 'welcome', 'generic', 'shares'] as const) assert.equal(featuresFor(r).length, PRO_FEATURES.length);
});

test('derived prices keep the store currency', async () => {
  const { formatPrice } = await import('../plans');
  assert.match(formatPrice(16.67, 'EUR', 'pt-PT'), /16,67\s€/);
  assert.match(formatPrice(359.88, 'USD', 'en-GB'), /US\$359\.88|\$359\.88/);
});
