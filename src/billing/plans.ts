// Everything about what Sweatbook Pro costs and what the free plan allows
// lives here, so prices, limits and paywall copy change in one place.
// Real prices shown on the paywall come from the store (RevenueCat); the
// numbers below are only the fallback when the store can't be reached.

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
    title: 'Já guardaste as tuas 3 mãos de hoje',
    body: 'Esta mão fica guardada como rascunho. Com Pro guardas todas as mãos da sessão, sem limite.',
  },
  shares: {
    title: 'Já partilhaste a mão de hoje',
    body: 'Com Pro partilhas todas as mãos que quiseres com os teus amigos.',
  },
  stats: {
    title: 'Vê o teu bankroll a fundo',
    body: 'Filtra por 30 dias, 90 dias ou ano e percebe onde estás a ganhar.',
  },
  story: {
    title: 'Stories sem marca de água',
    body: 'Partilha as tuas mãos no Instagram com o teu estilo, sem a marca Sweatbook.',
  },
  generic: {
    title: 'Sweatbook Pro',
    body: 'Tudo o que precisas para estudar as mãos que jogas ao vivo.',
  },
};

export const PRO_FEATURES: { icon: string; title: string; body: string }[] = [
  { icon: 'infinite', title: 'Mãos ilimitadas', body: 'Guarda todas as mãos da sessão, não só 3 por dia.' },
  { icon: 'logo-instagram', title: 'Stories sem marca de água', body: 'Mãos em formato vertical para o Instagram, sem a marca Sweatbook.' },
  { icon: 'stats-chart', title: 'Bankroll completo', body: 'Filtros por período, ROI, ITM e por hora.' },
  { icon: 'people', title: 'Partilha sem limites', body: 'Os teus amigos comentam e votam no browser, sem app.' },
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
