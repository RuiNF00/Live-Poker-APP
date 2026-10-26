/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cachedPro, cachedTier, proCache } from '../limits';
import { freeVsPro, offersPlus, PLANS, planOfProduct, PLUS_UNLOCKS, PRO_ONLY, PRODUCTS, TIER_PLANS, tierFor, unlocks, type FeatureKey, type PlanId, type ProFeature } from '../plans';
import { restoreFound } from '../buy-result';

const proFeatures = Object.keys(PRO_ONLY) as ProFeature[];

test('Plus never takes anything from the free plan, and Pro has everything', () => {
  for (const f of proFeatures) {
    if (!PRO_ONLY[f]) assert.ok(unlocks('free', f), `${f} is free today and must stay free`);
    assert.ok(unlocks('pro', f));
    // Whatever free has, Plus has too.
    if (unlocks('free', f)) assert.ok(unlocks('plus', f), f);
  }
});

test('Plus unlocks only what PLUS_UNLOCKS lists', () => {
  for (const f of proFeatures.filter((x) => PRO_ONLY[x])) assert.equal(unlocks('plus', f), !!PLUS_UNLOCKS[f], f);
  for (const k of ['hands', 'voiceHand', 'story', 'winrateDetail', 'monthCompare'] as FeatureKey[]) assert.ok(unlocks('plus', k), k);
  for (const k of ['staking', 'swaps', 'taxReport', 'homeTotal', 'insights', 'solver', 'mttStats'] as FeatureKey[]) assert.ok(!unlocks('plus', k), k);
});

test('the paywall opens on the cheapest tier that unlocks what was tapped; the trial offers open on Pro', () => {
  assert.equal(tierFor('hands'), 'plus');
  assert.equal(tierFor('handsLive'), 'plus');
  assert.equal(tierFor('voiceHand'), 'plus');
  assert.equal(tierFor('story'), 'plus');
  assert.equal(tierFor('winrateDetail'), 'plus');
  assert.equal(tierFor('staking'), 'pro');
  assert.equal(tierFor('stats'), 'pro');
  for (const r of ['welcome', 'sessionStart', 'generic', 'plan'] as const) {
    assert.equal(tierFor(r), 'pro', r);
    assert.ok(offersPlus(r), r);
  }
  // Pro-only reasons show no Plus tab: Plus wouldn't unlock what was tapped.
  assert.ok(!offersPlus('staking'));
  assert.ok(!offersPlus('taxReport'));
});

test('Pro prices stay as they are and the 3 free days stay on the yearly Pro only', () => {
  assert.equal(PLANS.monthly.price, 29.99);
  assert.equal(PLANS.annual.price, 199.99);
  assert.equal(PLANS.annual.trialDays, 3);
  assert.equal(PLANS.plusMonthly.trialDays, 0);
  assert.equal(PLANS.plusAnnual.trialDays, 0);
  assert.ok(PLANS.plusMonthly.price < PLANS.monthly.price && PLANS.plusAnnual.price < PLANS.annual.price);
  for (const tier of ['plus', 'pro'] as const) for (const id of Object.values(TIER_PLANS[tier])) assert.equal(PLANS[id].tier, tier);
});

test('store products map back to their plan, also with a Google Play base plan', () => {
  for (const id of Object.keys(PRODUCTS) as PlanId[]) {
    assert.equal(planOfProduct(PRODUCTS[id]), id);
    assert.equal(planOfProduct(`${PRODUCTS[id]}:base`), id);
  }
  assert.equal(planOfProduct('sweatbook_lifetime'), undefined);
});

test('the table has a Plus column that never shows less than the free one', () => {
  for (const r of freeVsPro()) {
    assert.ok('plus' in r, r.label);
    if (r.free === true) assert.equal(r.plus, true, r.label);
  }
});

test('the cached plan keeps Plus offline, and an old Pro cache still reads as Pro', () => {
  assert.equal(cachedTier(proCache('pro')), 'pro');
  assert.equal(cachedTier(proCache('plus')), 'plus');
  assert.equal(cachedTier(proCache('free')), 'free');
  assert.equal(cachedTier('1'), 'pro');
  assert.equal(cachedTier(null), 'free');
  assert.ok(!cachedPro(proCache('plus')));
});

test('a restore that finds only Plus says Plus', () => {
  const info = (active: Record<string, { productIdentifier: string; expirationDate: string | null }>) => ({ entitlements: { active } });
  const plus = { productIdentifier: 'sweatbook_plus_monthly', expirationDate: '2027-01-01T00:00:00Z' };
  assert.equal(restoreFound(info({ plus }), 'pro', 'sweatbook_lifetime', 'plus'), 'plus');
  assert.equal(restoreFound(info({ plus, pro: { productIdentifier: 'sweatbook_pro_annual', expirationDate: '2027-01-01T00:00:00Z' } }), 'pro', 'sweatbook_lifetime', 'plus'), 'ok');
  assert.equal(restoreFound(info({ plus }), 'pro', 'sweatbook_lifetime'), 'none');
});
