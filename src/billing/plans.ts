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

export type PaywallReason = 'hands' | 'shares' | 'stats' | 'story' | 'generic';

/** Headline per trigger: the paywall talks about what the player just tried to do. */
export const PAYWALL_COPY: Record<PaywallReason, { title: string; body: string }> = {
  hands: {
    title: t('Já guardaste as tuas 3 mãos de hoje'),
    body: t('Esta mão fica guardada como rascunho. Com Pro guardas todas as mãos da sessão, sem limite.'),
  },
  shares: {
    title: t('Já partilhaste a mão de hoje'),
    body: t('Com Pro partilhas todas as mãos que quiseres com os teus amigos.'),
  },
  stats: {
    title: t('Vê o teu bankroll a fundo'),
    body: t('Filtra por período, vê em que salas e jogos ganhas e exporta as sessões em CSV.'),
  },
  story: {
    title: t('Stories com a tua voz'),
    body: t('Explica a mão com a tua voz e partilha no Instagram em vídeo, sem a marca Sweatbook.'),
  },
  generic: {
    title: 'Sweatbook Pro',
    body: t('Tudo o que precisas para estudar as mãos que jogas ao vivo.'),
  },
};

export const PRO_FEATURES: { icon: string; title: string; body: string }[] = [
  { icon: 'infinite', title: t('Mãos ilimitadas'), body: t('Guarda todas as mãos da sessão, não só 3 por dia.') },
  { icon: 'logo-instagram', title: t('Stories com a tua voz'), body: t('Vídeo vertical para o Instagram com a tua explicação, sem a marca Sweatbook.') },
  { icon: 'stats-chart', title: t('Bankroll completo'), body: t('Filtros por período, resultados por sala e jogo, export CSV.') },
];

export function perMonth(annualPrice: number): number {
  return Math.round((annualPrice / 12) * 100) / 100;
}

export function annualSavingPct(monthly: number, annual: number): number {
  return Math.round((1 - annual / (monthly * 12)) * 100);
}

/** Apple and Google require these links next to the subscribe button. */
export const LEGAL = {
  terms: 'https://sweatbook.poker/terms.html',
  privacy: 'https://sweatbook.poker/privacy.html',
};
