// Thin wrapper over RevenueCat (react-native-purchases), which handles App
// Store and Google Play subscriptions, receipt checks and renewals for us.
// With no API key (Expo Go, web, a dev checkout) it falls back to a local
// demo store so the paywall can still be built and tested end to end.

import { Linking, Platform } from 'react-native';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

import { currencyAfter, decimalComma, lang, variant } from '../i18n';

import { buyError, playSubscriptionId, type BuyResult } from './buy-result';
import { offerMonths } from './disclosure';
import { DEFAULT_PAYWALL, parsePaywallConfig, type PaywallConfig } from './experiments';
import { ENTITLEMENT, INVITE, LIFETIME, PLANS, PRODUCTS, RETENTION, type PlanId } from './plans';

// RevenueCat's public iOS SDK key, meant to ship inside the app. Release builds
// fall back to it so a local Xcode build matches EAS; dev and local-Pro test
// builds (dev-pro.ts) keep the demo store.
const IOS_PUBLIC_KEY = 'appl_fWjswlOHLcGxlLzDaBThnQZuMKz';
const DEMO_STORE = __DEV__ || process.env.EXPO_PUBLIC_LOCAL_PRO === '1';

const KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || (DEMO_STORE ? undefined : IOS_PUBLIC_KEY),
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

let sdk: Promise<typeof import('react-native-purchases')> | null = null;
/**
 * The RevenueCat SDK, loaded and configured on first use. It is ~1 MB on web
 * and nothing needs it before the first store call, so it stays out of startup.
 */
function rcModule() {
  sdk ??= import('react-native-purchases').then((m) => {
    m.default.configure({ apiKey: KEY! });
    // Apple Ads: lets RevenueCat tie trials and purchases to a campaign and keyword. AdServices
    // needs no tracking prompt and carries no device id (marketing/apple-ads-bahamas.md).
    if (Platform.OS === 'ios') m.default.enableAdServicesAttributionTokenCollection().catch(() => {});
    return m;
  });
  return sdk;
}
const rc = async () => (await rcModule()).default;

export function configure(onChange: (isPro: boolean) => void): () => void {
  if (!LIVE) return () => {};
  const listener = (info: CustomerInfo) => onChange(hasPro(info));
  let stop: (() => void) | null = null;
  let stopped = false;
  rc()
    .then((P) => {
      if (stopped) return;
      P.addCustomerInfoUpdateListener(listener);
      stop = () => P.removeCustomerInfoUpdateListener(listener);
    })
    .catch(() => {});
  return () => {
    stopped = true;
    stop?.();
  };
}

function hasPro(info: CustomerInfo): boolean {
  return !!info.entitlements.active[ENTITLEMENT];
}

function usd(n: number) {
  const s = decimalComma ? n.toFixed(2).replace('.', ',') : n.toFixed(2);
  return lang === 'en' ? `$${s}` : currencyAfter ? `${s}\u00a0US$` : `US$\u00a0${s}`;
}

function fallbackPlans(): StorePlan[] {
  return (Object.keys(PLANS) as PlanId[]).map((id) => ({ id, price: PLANS[id].price, priceString: usd(PLANS[id].price), currency: 'USD', trialDays: PLANS[id].trialDays }));
}

const PLANS_TIMEOUT_MS = 8_000;
// Restoring can ask for the Apple ID password (and a 2FA code): give the player time to type it.
const RESTORE_TIMEOUT_MS = 60_000;

/** A card room's network can leave a store call hanging: give up so the screen can say so. */
function withTimeout<T>(run: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([run, new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error('timeout')), ms)))]).finally(() => clearTimeout(timer));
}

/**
 * Store plans, or null when the store couldn't be reached. A real build never
 * shows made-up prices (App Review 2.1): the paywall offers a retry instead.
 * The demo store (no key: Expo Go, web previews) keeps the fallback prices.
 */
export async function getPlans(): Promise<StorePlan[] | null> {
  if (!LIVE) return fallbackPlans();
  try {
    // Prices and trial eligibility under one deadline: the paywall shows a retry instead of a spinner forever.
    return await withTimeout(loadPlans(), PLANS_TIMEOUT_MS);
  } catch {
    return __DEV__ ? fallbackPlans() : null;
  }
}

async function loadPlans(): Promise<StorePlan[] | null> {
  const offerings = await (await rc()).getOfferings();
  const pkgs = offerings.current?.availablePackages ?? [];
  const plans: StorePlan[] = [];
  for (const id of Object.keys(PRODUCTS) as PlanId[]) {
    const pkg = pkgs.find((p) => p.product.identifier.startsWith(PRODUCTS[id]) || p.packageType === (id === 'monthly' ? 'MONTHLY' : 'ANNUAL'));
    if (pkg) plans.push({ id, pkg, price: pkg.product.price, priceString: pkg.product.priceString, currency: pkg.product.currencyCode || 'USD', trialDays: trialDays(pkg) });
  }
  if (Platform.OS === 'ios' && plans.length) {
    // iOS lists the intro offer even to players who already used it, so ask.
    // If that check fails or is slow, the plans still show, without a trial we can't promise.
    const { default: Purchases, INTRO_ELIGIBILITY_STATUS } = await rcModule();
    const elig = await withTimeout(Purchases.checkTrialOrIntroductoryPriceEligibility(plans.map((p) => p.pkg!.product.identifier)), 4000).catch(() => ({}) as Awaited<ReturnType<typeof Purchases.checkTrialOrIntroductoryPriceEligibility>>);
    for (const p of plans) {
      if (elig[p.pkg!.product.identifier]?.status !== INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE) p.trialDays = 0;
    }
  }
  return plans.length ? plans : __DEV__ ? fallbackPlans() : null;
}

/**
 * The paywall layout and copy for this player's offering. With RevenueCat
 * Experiments running, `current` is the offering the player was put in.
 */
export async function getPaywallConfig(): Promise<PaywallConfig> {
  if (!LIVE) return DEFAULT_PAYWALL;
  try {
    const cur = (await (await rc()).getOfferings()).current;
    return cur ? parsePaywallConfig(cur.identifier, cur.metadata, variant === 'pt-PT' ? 'pt' : variant) : DEFAULT_PAYWALL;
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
    return hasPro(await (await rc()).getCustomerInfo());
  } catch {
    return null;
  }
}

/** The running free trial, from the store. Null when not in one; undefined when the store can't say (demo store, offline). */
export async function getTrial(): Promise<{ start: number; end: number; willRenew: boolean } | null | undefined> {
  if (!LIVE) return undefined;
  try {
    const e = (await (await rc()).getCustomerInfo()).entitlements.active[ENTITLEMENT];
    if (!e || e.periodType !== 'TRIAL' || !e.expirationDateMillis) return null;
    return { start: e.latestPurchaseDateMillis, end: e.expirationDateMillis, willRenew: e.willRenew };
  } catch {
    return undefined;
  }
}

/** The player's current plan, for the cancel flow. Null when not subscribed through a store (demo, promo days). */
export async function getSubscription(): Promise<{ plan: PlanId; willRenew: boolean; product: string; ends: number | null } | null> {
  if (!LIVE) return null;
  try {
    const e = (await (await rc()).getCustomerInfo()).entitlements.active[ENTITLEMENT];
    if (!e || e.store === 'PROMOTIONAL') return null;
    const plan = (Object.keys(PRODUCTS) as PlanId[]).find((id) => e.productIdentifier.startsWith(PRODUCTS[id]));
    return plan ? { plan, willRenew: e.willRenew, product: e.productIdentifier, ends: e.expirationDateMillis ?? null } : null;
  } catch {
    return null;
  }
}

/**
 * When the store couldn't charge a renewal: Pro stays on through the store's grace period
 * (App Store Billing Grace Period, Google Play grace) while it retries. Null when all is well.
 */
export async function getBillingIssue(): Promise<{ since: number } | null> {
  if (!LIVE) return null;
  try {
    const e = (await (await rc()).getCustomerInfo()).entitlements.active[ENTITLEMENT];
    return e?.billingIssueDetectedAtMillis ? { since: e.billingIssueDetectedAtMillis } : null;
  } catch {
    return null;
  }
}

/** Opens the store's own subscription page, where cancelling happens. */
export async function manageSubscription(): Promise<void> {
  const fallback = Platform.OS === 'android' ? 'https://play.google.com/store/account/subscriptions' : 'https://apps.apple.com/account/subscriptions';
  try {
    if (LIVE && Platform.OS === 'ios') return await (await rc()).showManageSubscriptions();
    const url = LIVE ? (await (await rc()).getCustomerInfo()).managementURL : null;
    await Linking.openURL(url ?? fallback);
  } catch {
    await Linking.openURL(fallback).catch(() => {});
  }
}

/** Redeems an offer code (free Pro codes for trusted players): Apple's own sheet, or Google Play's redeem page. */
export async function redeemCode(): Promise<void> {
  const play = 'https://play.google.com/redeem';
  try {
    if (LIVE && Platform.OS === 'ios') return await (await rc()).presentCodeRedemptionSheet();
    await Linking.openURL(Platform.OS === 'ios' ? 'https://apps.apple.com/redeem' : play);
  } catch {
    await Linking.openURL(play).catch(() => {});
  }
}

/** A store offer with its price as the store writes it. */
export interface StoreOffer {
  priceString: string;
  buy: () => Promise<BuyResult>;
}

/**
 * The cancel-flow discount on the monthly plan, when it exists in the store. `price` and
 * `months` are the store's own, so the screen's "−40% durante 3 meses" matches what is
 * charged (`months` null: the store didn't say it in months).
 */
export async function retentionOffer(plans: StorePlan[], replacing?: string | null): Promise<(StoreOffer & { price: number; months: number | null }) | null> {
  const monthly = plans.find((p) => p.id === 'monthly');
  // Demo store (dev builds and web): same shape as the lifetime one, so the cancel flow can be walked end to end.
  if (!LIVE) {
    if (!__DEV__ || !monthly) return null;
    const price = Math.round(monthly.price * (100 - RETENTION.discount.pct)) / 100;
    return { priceString: usd(price), price, months: RETENTION.discount.months, buy: async () => 'ok' as const };
  }
  const pkg = monthly?.pkg;
  if (!pkg) return null;
  try {
    if (Platform.OS === 'ios') {
      const d = pkg.product.discounts?.find((x) => x.identifier === RETENTION.discount.ios);
      if (!RETENTION.discount.ios || !d) return null;
      const Purchases = await rc();
      const offer = await Purchases.getPromotionalOffer(pkg.product, d);
      if (!offer) return null;
      return { priceString: d.priceString, price: d.price, months: offerMonths(d.periodUnit, d.periodNumberOfUnits, d.cycles), buy: () => attempt(() => Purchases.purchaseDiscountedPackage(pkg, offer)) };
    }
    const opt = pkg.product.subscriptionOptions?.find((o) => o.tags.includes(RETENTION.discount.android) || o.id.endsWith(`:${RETENTION.discount.android}`));
    const first = opt?.pricingPhases[0];
    if (!RETENTION.discount.android || !opt || !first) return null;
    return {
      priceString: first.price.formatted,
      price: first.price.amountMicros / 1e6,
      months: offerMonths(first.billingPeriod.unit, first.billingPeriod.value, first.billingCycleCount),
      // A monthly subscriber can't buy the same subscription again on Google Play: the offer
      // replaces the running one, with the unused days credited.
      buy: async () => {
        const { PRORATION_MODE } = await rcModule();
        const change = replacing ? { oldProductIdentifier: playSubscriptionId(replacing), prorationMode: PRORATION_MODE.IMMEDIATE_WITH_TIME_PRORATION } : null;
        return attempt(async () => (await rc()).purchaseSubscriptionOption(opt, change));
      },
    };
  } catch {
    return null;
  }
}

/** The invite discount's first-month price on Google Play, as the store writes it. Null on the App Store (Apple's code sheet shows it) or when the offer isn't there. */
export function inviteOfferPrice(plans: StorePlan[]): { priceString: string; price: number } | null {
  if (!LIVE || Platform.OS !== 'android') return null;
  const opt = plans.find((p) => p.id === 'monthly')?.pkg?.product.subscriptionOptions?.find((o) => o.tags.includes(INVITE.android) || o.id.endsWith(`:${INVITE.android}`));
  const first = opt?.pricingPhases[0]?.price;
  return first ? { priceString: first.formatted, price: first.amountMicros / 1e6 } : null;
}

// One store sheet at a time: the sheet takes a moment to appear, and a second tap meanwhile
// would start a second purchase (paywall, cancel offers, invite, lifetime all come through here).
// A store call that never comes back stops guarding after a few minutes, so buying works again
// without restarting the app (the sheet itself may stay open that long while the player decides).
const BUYING_STALE_MS = 5 * 60_000;
let buying = 0;

async function attempt(run: () => Promise<{ customerInfo: CustomerInfo }>): Promise<BuyResult> {
  if (buying && Date.now() - buying < BUYING_STALE_MS) return 'busy';
  const mine = (buying = Date.now());
  try {
    // The store finished the purchase but Pro isn't on yet (RevenueCat still syncing): never say nothing was charged.
    return hasPro((await run()).customerInfo) ? 'ok' : 'pending';
  } catch (e) {
    return buyError(e);
  } finally {
    // A late answer from a stale call doesn't free a newer purchase's guard.
    if (buying === mine) buying = 0;
  }
}

export { buyError, type BuyResult } from './buy-result';

/**
 * Uses the invite discount on the monthly plan. Google Play: buys the monthly with the invite
 * offer. App Store: opens the redeem page with the player's one-time code ('redeem': Pro turns
 * on through the listener once redeemed; without the app id the sheet opens and the code is pasted).
 */
export async function redeemInviteOffer(plans: StorePlan[], iosCode: string | null): Promise<BuyResult | 'redeem'> {
  if (!LIVE) return __DEV__ ? 'ok' : 'unavailable';
  try {
    if (Platform.OS === 'ios') {
      if (!iosCode) return 'unavailable';
      const id = process.env.EXPO_PUBLIC_APPLE_APP_ID;
      if (id) await Linking.openURL(`https://apps.apple.com/redeem?ctx=offercodes&id=${encodeURIComponent(id)}&code=${encodeURIComponent(iosCode)}`);
      else await (await rc()).presentCodeRedemptionSheet();
      return 'redeem';
    }
    const opt = plans.find((p) => p.id === 'monthly')?.pkg?.product.subscriptionOptions?.find((o) => o.tags.includes(INVITE.android) || o.id.endsWith(`:${INVITE.android}`));
    if (!opt) return 'unavailable';
    return await attempt(async () => (await rc()).purchaseSubscriptionOption(opt));
  } catch {
    return 'unavailable';
  }
}

/** One-time Pro for the cancel flow, when switched on in plans.ts and present in the current offering. */
export async function lifetimeOffer(): Promise<StoreOffer | null> {
  if (!LIFETIME.enabled) return null;
  // Expo Go / dev checkout (demo store): a stand-in so the cancel flow can be tried. Never in a store build.
  if (!LIVE) return __DEV__ ? { priceString: usd(LIFETIME.usd), buy: async () => 'ok' as const } : null;
  try {
    const P = await rc();
    const cur = (await P.getOfferings()).current;
    if (!cur || cur.metadata?.lifetime === false) return null;
    const pkg = cur.availablePackages.find((p) => p.product.identifier === LIFETIME.product || p.packageType === 'LIFETIME');
    return pkg ? { priceString: pkg.product.priceString, buy: () => attempt(() => P.purchasePackage(pkg)) } : null;
  } catch {
    return null;
  }
}

/**
 * Buys a plan. `replacing` is the store product of the plan being left (monthly to annual):
 * the App Store swaps plans inside the subscription group by itself; Google Play needs it said,
 * or the player would end up with two subscriptions.
 */
export async function buy(plan: StorePlan, replacing?: string): Promise<BuyResult> {
  if (!LIVE) return __DEV__ ? 'ok' : 'unavailable';
  if (!plan.pkg) return 'unavailable';
  const P = await rc().catch(() => null);
  if (!P) return 'unavailable';
  const { PRORATION_MODE } = await rcModule();
  const change =
    Platform.OS === 'android' && replacing
      ? { oldProductIdentifier: playSubscriptionId(replacing), prorationMode: PRORATION_MODE.IMMEDIATE_WITH_TIME_PRORATION }
      : null;
  return attempt(() => P.purchasePackage(plan.pkg!, null, change));
}

/** 'none': the store answered and this account has no subscription; 'error': it didn't answer. */
/** 'slow': the store is still answering (an Apple ID sign-in can take a while); Pro turns on by itself if it finds the purchase. 'busy': one is already running. */
export type RestoreResult = 'ok' | 'none' | 'error' | 'slow' | 'busy';

// Held until the store answers, also after we stop waiting: a second restore never runs alongside the first
// (a call that never answers stops holding it after a few minutes, as with purchases).
let restoring = 0;

export async function restore(): Promise<RestoreResult> {
  if (!LIVE) return 'none';
  if (restoring && Date.now() - restoring < BUYING_STALE_MS) return 'busy';
  const mine = (restoring = Date.now());
  const run = (async () => (await rc()).restorePurchases())();
  run.then(
    () => void (restoring === mine && (restoring = 0)),
    () => void (restoring === mine && (restoring = 0)),
  );
  try {
    return hasPro(await withTimeout(run, RESTORE_TIMEOUT_MS)) ? 'ok' : 'none';
  } catch (e) {
    return (e as Error)?.message === 'timeout' ? 'slow' : 'error';
  }
}

/** Link the store customer to the Supabase account once the player signs in. */
export async function identify(userId: string): Promise<void> {
  if (!LIVE) return;
  await (await rc()).logIn(userId).catch(() => {});
}

/** RevenueCat's user id for this install (anonymous or signed in), so server-side grants find it. */
export async function appUserId(): Promise<string | undefined> {
  if (!LIVE) return undefined;
  try {
    return await (await rc()).getAppUserID();
  } catch {
    return undefined;
  }
}
