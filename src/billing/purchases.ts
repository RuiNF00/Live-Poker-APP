// Thin wrapper over RevenueCat (react-native-purchases), which handles App
// Store and Google Play subscriptions, receipt checks and renewals for us.
// With no API key (Expo Go, web, a dev checkout) it falls back to a local
// demo store so the paywall can still be built and tested end to end.

import { Platform } from 'react-native';
import Purchases, { INTRO_ELIGIBILITY_STATUS, type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

import { ENTITLEMENT, PLANS, PRODUCTS, type PlanId } from './plans';

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
  return `${n.toFixed(2).replace('.', ',')} US$`;
}

function fallbackPlans(): StorePlan[] {
  return (Object.keys(PLANS) as PlanId[]).map((id) => ({ id, price: PLANS[id].price, priceString: usd(PLANS[id].price), trialDays: PLANS[id].trialDays }));
}

export async function getPlans(): Promise<StorePlan[]> {
  if (!LIVE) return fallbackPlans();
  try {
    const offerings = await Purchases.getOfferings();
    const pkgs = offerings.current?.availablePackages ?? [];
    const plans: StorePlan[] = [];
    for (const id of Object.keys(PRODUCTS) as PlanId[]) {
      const pkg = pkgs.find((p) => p.product.identifier.startsWith(PRODUCTS[id]) || p.packageType === (id === 'monthly' ? 'MONTHLY' : 'ANNUAL'));
      if (pkg) plans.push({ id, pkg, price: pkg.product.price, priceString: pkg.product.priceString, trialDays: trialDays(pkg) });
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
