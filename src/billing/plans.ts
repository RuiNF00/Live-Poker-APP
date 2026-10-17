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

/**
 * Offers in the cancel flow. Only ever offered there, never after onboarding.
 * The price the player sees always comes from the store offer itself; `pct`
 * and `months` are what to create in the stores. Until an offer with this id
 * exists there, the app hides it.
 */
export const RETENTION = {
  /** "Não cabe no meu bankroll": App Store promotional offer / Google Play offer on the monthly plan. */
  discount: { pct: 40, months: 3, ios: 'sweatbook_retention_40', android: 'sweatbook-retention-40' },
  /** Google Play lets subscribers pause; the App Store doesn't. */
  pauseMonths: 3,
};

/**
 * One-time Pro, offered only in the cancel flow to players who don't want a
 * subscription. Off until Rui decides. Create `product` in both stores as a
 * non-consumable granting the `pro` entitlement, in RevenueCat's offering as
 * the Lifetime package. The price shown always comes from the store; `usd`
 * is what to set there.
 */
export const LIFETIME = { enabled: false, product: 'sweatbook_lifetime', usd: 499 };

/** Free plan. `null` means no limit. */
export const FREE = {
  /** New hands saved per calendar day. The 4th waits as a draft, never lost. */
  handsPerDay: 3 as number | null,
  /**
   * Link shares per day. Kept unlimited on purpose: every share puts the
   * brand in front of friends who don't have the app yet.
   */
  sharesPerDay: null as number | null,
  /** Bankroll date and stake filters ("Sempre" and every stake stay free). */
  bankrollFilters: false,
  /** Bankrolls the player can have. Ones made automatically for older data are kept either way. */
  bankrolls: 1 as number | null,
  /** Trips (festivals) with expenses. The first is free so a player sees it work on a real trip. */
  trips: 1 as number | null,
};

export type PaywallReason = 'hands' | 'shares' | 'stats' | 'story' | 'solver' | 'welcome' | 'plan' | 'generic';

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
    body: t('Várias bankrolls, filtros, salas, jogos e CSV.'),
  },
  story: {
    title: t('Stories com a tua voz'),
    body: t('Vídeo com voz, sem marca de água.'),
  },
  solver: {
    title: t('Leva as mãos todas para o solver'),
    body: t('Com Pro, exportas várias mãos de uma vez para GTO Wizard, PioSolver ou PokerTracker.'),
  },
  welcome: {
    title: t('Primeira mão feita'),
    body: t('Com Pro, guardas todas as mãos da sessão.'),
  },
  plan: {
    title: t('Começa o teu plano'),
    body: t('Tudo o que escolheste. Sem limites.'),
  },
  generic: {
    title: 'Sweatbook Pro',
    body: t('Todas as mãos. Todo o bankroll.'),
  },
};

export type FeatureKey = 'hands' | 'story' | 'stats';

export const PRO_FEATURES: { key: FeatureKey; icon: string; title: string; body: string }[] = [
  { key: 'hands', icon: 'infinite', title: t('Mãos ilimitadas'), body: t('Sem limite diário') },
  { key: 'stats', icon: 'stats-chart', title: t('Bankroll completo'), body: t('Várias bankrolls, filtros, CSV') },
  { key: 'story', icon: 'mic', title: t('Stories com voz'), body: t('Sem marca de água') },
];

/** Features in paywall order: the one the player just reached for comes first. */
export function featuresFor(reason: PaywallReason): { feature: (typeof PRO_FEATURES)[number]; highlight: boolean }[] {
  const key: FeatureKey | null = reason === 'hands' || reason === 'welcome' ? 'hands' : reason === 'stats' || reason === 'story' ? reason : null;
  const first = PRO_FEATURES.filter((f) => f.key === key);
  return [...first, ...PRO_FEATURES.filter((f) => f.key !== key)].map((feature) => ({ feature, highlight: feature.key === key }));
}

type Cell = string | boolean;

/** Free vs Pro, for the "table" paywall. Built from FREE so the limits never drift. Portuguese labels; show with t(). */
export function freeVsPro(): { label: string; free: Cell; pro: Cell }[] {
  const n = (v: number | null): Cell => (v === null ? '∞' : String(v));
  return [
    { label: 'Mãos novas por dia', free: n(FREE.handsPerDay), pro: '∞' },
    { label: 'Replayer e partilha por link', free: true, pro: true },
    { label: 'Bankrolls', free: n(FREE.bankrolls), pro: '∞' },
    { label: 'Filtros, salas e CSV', free: FREE.bankrollFilters, pro: true },
    { label: 'Stories com voz', free: false, pro: true },
    { label: 'Várias mãos para o solver', free: false, pro: true },
  ];
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
