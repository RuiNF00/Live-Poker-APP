/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { canUse, pruneLog, remainingToday, usedToday, type UsageEvent } from '../limits';
import { annualSavingPct, featuresFor, perMonth, PLANS, PRO_FEATURES, PRO_ONLY, type ProFeature } from '../plans';

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
  assert.equal(annualSavingPct(10, 72), 40); // exactly 40 % stays 40, float noise aside
  assert.equal(annualSavingPct(10, 70.9), 40); // 40.9 % reads 40
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
  for (const r of ['hands', 'stats', 'story', 'welcome', 'generic', 'taxReport', 'staking'] as const) assert.equal(featuresFor(r).length, 3);
  // A gated feature leads with its own row, then two generic ones.
  assert.deepEqual(featuresFor('taxReport').map((f) => f.feature.key), ['taxReport', 'hands', 'stats']);
  assert.ok(PRO_FEATURES.length > 3);
});

test('derived prices keep the store currency', async () => {
  const { formatPrice } = await import('../plans');
  assert.match(formatPrice(16.67, 'EUR', 'pt-PT'), /16,67\s€/);
  assert.match(formatPrice(359.88, 'USD', 'en-GB'), /US\$359\.88|\$359\.88/);
});

test('per-month price is written like the store price next to it', async () => {
  const { priceLike } = await import('../plans');
  assert.equal(priceLike('$199.99', 16.67, 'USD', 'en-GB'), '$16.67');
  assert.equal(priceLike('199,99\u00a0US$', 16.67, 'USD', 'pt-PT'), '16,67\u00a0US$');
  assert.equal(priceLike('R$ 1.099,90', 91.66, 'BRL', 'pt-BR'), 'R$ 91,66');
  // Zero- and three-decimal currencies keep the store's thousands separator and decimals.
  assert.equal(priceLike('¥29,800', 2483.33, 'JPY', 'ja-JP'), '¥2,483');
  assert.equal(priceLike('₩299,000', 24916.67, 'KRW', 'ko-KR'), '₩24,917');
  assert.equal(priceLike('$189.990', 15832.5, 'CLP', 'es-CL'), '$15.833');
  assert.equal(priceLike('KWD 59.990', 4.99917, 'KWD', 'en'), 'KWD 4.999');
  assert.equal(priceLike('59,990 KWD', 4.99917, 'KWD', 'ar'), '4,999 KWD');
  // CHF groups with ’; a store price with no cents still shows the monthly cents; KWD to the fils.
  assert.equal(priceLike('CHF 1’999.00', 166.58, 'CHF', 'de-CH'), 'CHF 166.58');
  assert.equal(priceLike('CHF 19’999.00', 1666.58, 'CHF', 'de-CH'), 'CHF 1’666.58');
  assert.equal(priceLike('199 kr', 16.58, 'SEK', 'sv-SE'), '16,58 kr');
  assert.equal(priceLike('199 kr', 17, 'SEK', 'sv-SE'), '17 kr');
  const { perMonth: pm } = await import('../plans');
  assert.equal(pm(59.99, 'KWD'), 4.999);
  assert.equal(pm(199.99, 'USD'), 16.67);
  assert.equal(pm(29800, 'JPY'), 2483);
  assert.match(priceLike('free', 16.67, 'EUR', 'pt-PT'), /16,67\s€/);
});

test('turning the clock back does not free up today\'s hands', () => {
  const full = [day(20), day(20, 1), day(20, 2)].map((t) => ({ kind: 'hand' as const, t }));
  // Same day, clock set back to the morning.
  assert.equal(canUse(full, 'hand', 3, false, day(8)), false);
  // Clock set back to yesterday: today's saves still count (kept by pruneLog too).
  assert.equal(canUse(pruneLog(full, yesterday), 'hand', 3, false, yesterday), false);
});

test('every Pro feature leads its own paywall: a feature row, and the paywall opened from its lock puts it first', () => {
  for (const f of [...(Object.keys(PRO_ONLY) as ProFeature[]), 'mttStats' as const, 'varianceMine' as const, 'trips' as const]) {
    assert.ok(PRO_FEATURES.some((x) => x.key === f), `${f} has no feature row`);
    const rows = featuresFor(f);
    assert.equal(rows[0].feature.key, f, `${f} does not lead its paywall`);
    assert.equal(rows[0].highlight, true);
  }
});
