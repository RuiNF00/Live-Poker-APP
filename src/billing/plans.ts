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
  /** Bankroll date and stake filters ("Sempre" and every stake stay free). */
  bankrollFilters: false,
  /** Bankrolls the player can have. Ones made automatically for older data are kept either way. */
  bankrolls: 1 as number | null,
};

export type PaywallReason = 'hands' | 'shares' | 'stats' | 'story' | 'welcome' | 'generic';

/** Headline per trigger: the paywall talks about what the player just tried to do. */
export const PAYWALL_COPY: Record<PaywallReason, { title: string; body: string }> = {
  hands: {
    title: t('Esta mão não se perde'),
    body: t('Já guardaste as 3 mãos grátis de hoje, por isso fica como rascunho. Com Pro guardas todas as mãos da sessão, sem contar.'),
  },
  shares: {
    title: t('Já partilhaste a mão de hoje'),
    body: t('Com Pro partilhas todas as mãos que quiseres com os teus amigos.'),
  },
  stats: {
    title: t('Vê o teu bankroll a fundo'),
    body: t('Várias bankrolls, filtros por datas e stakes, em que salas e jogos ganhas, e as sessões em CSV.'),
  },
  story: {
    title: t('Stories com a tua voz'),
    body: t('Explica a mão com a tua voz e partilha no Instagram em vídeo, sem a marca Sweatbook.'),
  },
  welcome: {
    title: t('A tua primeira mão já está no caderno'),
    body: t('Numa sessão ao vivo jogas dezenas de mãos que vale a pena rever. Com Pro guardas todas, sem limite diário.'),
  },
  generic: {
    title: 'Sweatbook Pro',
    body: t('Regista todas as mãos que jogas ao vivo e percebe onde ganhas e onde perdes dinheiro.'),
  },
};

export type FeatureKey = 'hands' | 'story' | 'stats';

export const PRO_FEATURES: { key: FeatureKey; icon: string; title: string; body: string }[] = [
  { key: 'hands', icon: 'infinite', title: t('Mãos ilimitadas'), body: t('Guarda todas as mãos da sessão, não só 3 por dia.') },
  { key: 'stats', icon: 'stats-chart', title: t('Bankroll completo'), body: t('Várias bankrolls, filtros por datas e stakes, resultados por sala e jogo, export CSV.') },
  { key: 'story', icon: 'logo-instagram', title: t('Stories com a tua voz'), body: t('Vídeo vertical para o Instagram com a tua explicação, sem a marca Sweatbook.') },
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
