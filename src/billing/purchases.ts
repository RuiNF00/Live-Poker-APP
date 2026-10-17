// Thin wrapper over RevenueCat (react-native-purchases), which handles App
// Store and Google Play subscriptions, receipt checks and renewals for us.
// With no API key (Expo Go, web, a dev checkout) it falls back to a local
// demo store so the paywall can still be built and tested end to end.

import { Linking, Platform } from 'react-native';
import Purchases, { INTRO_ELIGIBILITY_STATUS, type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

import { lang } from '../i18n';

import { DEFAULT_PAYWALL, parsePaywallConfig, type PaywallConfig } from './experiments';
import { ENTITLEMENT, PLANS, PRODUCTS, RETENTION, type PlanId } from './plans';

const KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  default: undefined,
});

/** True when payments go through the real stores. */
export const LIVE = !!KEY;

export interface StorePlan {
  id: PlanId;
  priceString: string;
  price: number;
  /** ISO currency of the store price, so derived prices (per month) match it. */
  currency: string;
  /** Free trial days this player can still get (0 if none or already used). */
  trialDays: number;
  pkg?: PurchasesPackage;
}

let configured = false;

export function configure(onChange: (isPro: boolean) => void): () => void {
  if (!LIVE) return () => {};
  if (!configured) {
    Purchases.configure({ apiKey: KEY! });
    configured = true;
  }
  const listener = (info: CustomerInfo) => onChange(hasPro(info));
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

function hasPro(info: CustomerInfo): boolean {
  return !!info.entitlements.active[ENTITLEMENT];
}

function usd(n: number) {
  return lang === 'pt' ? `${n.toFixed(2).replace('.', ',')} US$` : `$${n.toFixed(2)}`;
}

function fallbackPlans(): StorePlan[] {
  return (Object.keys(PLANS) as PlanId[]).map((id) => ({ id, price: PLANS[id].price, priceString: usd(PLANS[id].price), currency: 'USD', trialDays: PLANS[id].trialDays }));
}

export async function getPlans(): Promise<StorePlan[]> {
  if (!LIVE) return fallbackPlans();
  try {
    const offerings = await Purchases.getOfferings();
    const pkgs = offerings.current?.availablePackages ?? [];
    const plans: StorePlan[] = [];
    for (const id of Object.keys(PRODUCTS) as PlanId[]) {
      const pkg = pkgs.find((p) => p.product.identifier.startsWith(PRODUCTS[id]) || p.packageType === (id === 'monthly' ? 'MONTHLY' : 'ANNUAL'));
      if (pkg) plans.push({ id, pkg, price: pkg.product.price, priceString: pkg.product.priceString, currency: pkg.product.currencyCode || 'USD', trialDays: trialDays(pkg) });
    }
    if (Platform.OS === 'ios' && plans.length) {
      // iOS lists the intro offer even to players who already used it, so ask.
      const elig = await Purchases.checkTrialOrIntroductoryPriceEligibility(plans.map((p) => p.pkg!.product.identifier));
      for (const p of plans) {
        if (elig[p.pkg!.product.identifier]?.status !== INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE) p.trialDays = 0;
      }
    }
    return plans.length ? plans : fallbackPlans();
  } catch {
    return fallbackPlans();
  }
}

/**
 * The paywall layout and copy for this player's offering. With RevenueCat
 * Experiments running, `current` is the offering the player was put in.
 */
export async function getPaywallConfig(): Promise<PaywallConfig> {
  if (!LIVE) return DEFAULT_PAYWALL;
  try {
    const cur = (await Purchases.getOfferings()).current;
    return cur ? parsePaywallConfig(cur.identifier, cur.metadata, lang) : DEFAULT_PAYWALL;
  } catch {
    return DEFAULT_PAYWALL;
  }
}

function trialDays(pkg: PurchasesPackage): number {
  const intro = pkg.product.introPrice;
  if (!intro || intro.price !== 0) return 0;
  const unit = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 }[intro.periodUnit] ?? 0;
  return unit * intro.periodNumberOfUnits;
}

export async function getIsPro(): Promise<boolean | null> {
  if (!LIVE) return null;
  try {
    return hasPro(await Purchases.getCustomerInfo());
  } catch {
    return null;
  }
}

/** The running free trial, from the store. Null when not in one; undefined when the store can't say (demo store, offline). */
export async function getTrial(): Promise<{ start: number; end: number; willRenew: boolean } | null | undefined> {
  if (!LIVE) return undefined;
  try {
    const e = (await Purchases.getCustomerInfo()).entitlements.active[ENTITLEMENT];
    if (!e || e.periodType !== 'TRIAL' || !e.expirationDateMillis) return null;
    return { start: e.latestPurchaseDateMillis, end: e.expirationDateMillis, willRenew: e.willRenew };
  } catch {
    return undefined;
  }
}

/** The player's current plan, for the cancel flow. Null when not subscribed through a store (demo, promo days). */
export async function getSubscription(): Promise<{ plan: PlanId; willRenew: boolean } | null> {
  if (!LIVE) return null;
  try {
    const e = (await Purchases.getCustomerInfo()).entitlements.active[ENTITLEMENT];
    if (!e || e.store === 'PROMOTIONAL') return null;
    const plan = (Object.keys(PRODUCTS) as PlanId[]).find((id) => e.productIdentifier.startsWith(PRODUCTS[id]));
    return plan ? { plan, willRenew: e.willRenew } : null;
  } catch {
    return null;
  }
}

/** Opens the store's own subscription page, where cancelling happens. */
export async function manageSubscription(): Promise<void> {
  const fallback = Platform.OS === 'android' ? 'https://play.google.com/store/account/subscriptions' : 'https://apps.apple.com/account/subscriptions';
  try {
    if (LIVE && Platform.OS === 'ios') return await Purchases.showManageSubscriptions();
    const url = LIVE ? (await Purchases.getCustomerInfo()).managementURL : null;
    await Linking.openURL(url ?? fallback);
  } catch {
    await Linking.openURL(fallback).catch(() => {});
  }
}

/** The cancel-flow discount on the monthly plan, when it exists in the store. */
export async function retentionOffer(plans: StorePlan[]): Promise<{ priceString: string; buy: () => Promise<BuyResult> } | null> {
  const pkg = plans.find((p) => p.id === 'monthly')?.pkg;
  if (!LIVE || !pkg) return null;
  try {
    if (Platform.OS === 'ios') {
      const d = pkg.product.discounts?.find((x) => x.identifier === RETENTION.discount.ios);
      if (!RETENTION.discount.ios || !d) return null;
      const offer = await Purchases.getPromotionalOffer(pkg.product, d);
      if (!offer) return null;
      return { priceString: d.priceString, buy: () => attempt(() => Purchases.purchaseDiscountedPackage(pkg, offer)) };
    }
    const opt = pkg.product.subscriptionOptions?.find((o) => o.tags.includes(RETENTION.discount.android) || o.id.endsWith(`:${RETENTION.discount.android}`));
    const first = opt?.pricingPhases[0];
    if (!RETENTION.discount.android || !opt || !first) return null;
    return { priceString: first.price.formatted, buy: () => attempt(() => Purchases.purchaseSubscriptionOption(opt)) };
  } catch {
    return null;
  }
}

async function attempt(run: () => Promise<{ customerInfo: CustomerInfo }>): Promise<BuyResult> {
  try {
    return hasPro((await run()).customerInfo) ? 'ok' : 'error';
  } catch (e) {
    return (e as { userCancelled?: boolean }).userCancelled ? 'cancelled' : 'error';
  }
}

export type BuyResult = 'ok' | 'cancelled' | 'unavailable' | 'error';

export async function buy(plan: StorePlan): Promise<BuyResult> {
  if (!LIVE) return __DEV__ ? 'ok' : 'unavailable';
  if (!plan.pkg) return 'unavailable';
  try {
    const { customerInfo } = await Purchases.purchasePackage(plan.pkg);
    return hasPro(customerInfo) ? 'ok' : 'error';
  } catch (e) {
    return (e as { userCancelled?: boolean }).userCancelled ? 'cancelled' : 'error';
  }
}

export async function restore(): Promise<boolean> {
  if (!LIVE) return false;
  try {
    return hasPro(await Purchases.restorePurchases());
  } catch {
    return false;
  }
}

/** Link the store customer to the Supabase account once the player signs in. */
export async function identify(userId: string): Promise<void> {
  if (!LIVE) return;
  await Purchases.logIn(userId).catch(() => {});
}

/** RevenueCat's user id for this install (anonymous or signed in), so server-side grants find it. */
export async function appUserId(): Promise<string | undefined> {
  if (!LIVE) return undefined;
  try {
    return await Purchases.getAppUserID();
  } catch {
    return undefined;
  }
}
