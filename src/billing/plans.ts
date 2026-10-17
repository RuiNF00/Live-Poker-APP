// Everything about what Sweatbook Pro costs and what the free plan allows
// lives here, so prices, limits and paywall copy change in one place.
// Real prices shown on the paywall come from the store (RevenueCat); the
// numbers below are only the fallback when the store can't be reached.

import { t } from '../i18n';

export const ENTITLEMENT = 'pro';

/** Store product ids. Create these exactly in App Store Connect and Google Play. */
export const PRODUCTS = {
  monthly: 'sweatbook_pro_monthly',
  annual: 'sweatbook_pro_annual',
} as const;

export type PlanId = keyof typeof PRODUCTS;

export interface PlanInfo {
  id: PlanId;
  /** USD price, used when the store prices haven't loaded. */
  price: number;
  /** Portuguese key; show it with t(). */
  period: 'mês' | 'ano';
  /** Free trial days (store intro offer). 0 = none. */
  trialDays: number;
}

export const PLANS: Record<PlanId, PlanInfo> = {
  monthly: { id: 'monthly', price: 29.99, period: 'mês', trialDays: 0 },
  annual: { id: 'annual', price: 199.99, period: 'ano', trialDays: 7 },
};

/** Free plan. `null` means no limit. */
export const FREE = {
  /** New hands saved per calendar day. The 4th waits as a draft, never lost. */
  handsPerDay: 3 as number | null,
  /**
   * Link shares per day. Kept unlimited on purpose: every share puts the
   * brand in front of friends who don't have the app yet.
   */
  sharesPerDay: null as number | null,
  /** Bankroll period filters other than "Sempre". */
  bankrollFilters: false,
};

export type PaywallReason = 'hands' | 'shares' | 'stats' | 'story' | 'welcome' | 'generic';

/** Headline per trigger: the paywall talks about what the player just tried to do. One idea per line. */
export const PAYWALL_COPY: Record<PaywallReason, { title: string; body: string }> = {
  hands: {
    title: t('Mão guardada como rascunho'),
    body: t('Com Pro, guardas mãos sem limite.'),
  },
  shares: {
    title: t('Já partilhaste a mão de hoje'),
    body: t('Com Pro, partilhas sem limite.'),
  },
  stats: {
    title: t('Conhece o teu bankroll'),
    body: t('Filtros, salas, jogos e CSV.'),
  },
  story: {
    title: t('Stories com a tua voz'),
    body: t('Vídeo com voz, sem marca de água.'),
  },
  welcome: {
    title: t('Primeira mão feita'),
    body: t('Com Pro, guardas todas as mãos da sessão.'),
  },
  generic: {
    title: 'Sweatbook Pro',
    body: t('Todas as mãos. Todo o bankroll.'),
  },
};

export type FeatureKey = 'hands' | 'story' | 'stats';

export const PRO_FEATURES: { key: FeatureKey; icon: string; title: string; body: string }[] = [
  { key: 'hands', icon: 'infinite', title: t('Mãos ilimitadas'), body: t('Sem limite diário') },
  { key: 'stats', icon: 'stats-chart', title: t('Bankroll completo'), body: t('Filtros, salas, CSV') },
  { key: 'story', icon: 'mic', title: t('Stories com voz'), body: t('Sem marca de água') },
];

/** Features in paywall order: the one the player just reached for comes first. */
export function featuresFor(reason: PaywallReason): { feature: (typeof PRO_FEATURES)[number]; highlight: boolean }[] {
  const key: FeatureKey | null = reason === 'hands' || reason === 'welcome' ? 'hands' : reason === 'stats' || reason === 'story' ? reason : null;
  const first = PRO_FEATURES.filter((f) => f.key === key);
  return [...first, ...PRO_FEATURES.filter((f) => f.key !== key)].map((feature) => ({ feature, highlight: feature.key === key }));
}

export function perMonth(annualPrice: number): number {
  return Math.round((annualPrice / 12) * 100) / 100;
}

/** Price in the store's own currency, for numbers we derive (per month, a year of monthly). */
export function formatPrice(n: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export function annualSavingPct(monthly: number, annual: number): number {
  return Math.round((1 - annual / (monthly * 12)) * 100);
}

/** Apple and Google require these links next to the subscribe button. */
export const LEGAL = {
  terms: 'https://sweatbook.poker/terms.html',
  privacy: 'https://sweatbook.poker/privacy.html',
};
