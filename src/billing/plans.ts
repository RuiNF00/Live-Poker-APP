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
  // Demo store only: real builds read the trial from the store product (3 days, Rui 17 Oct).
  annual: { id: 'annual', price: 199.99, period: 'ano', trialDays: 3 },
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
 * subscription (Rui, 17 Oct). Never on the paywall. Without a release, turn it
 * off by removing the Lifetime package from the RevenueCat offering or by
 * setting `"lifetime": false` in its metadata. Create `product` in both stores as a
 * non-consumable granting the `pro` entitlement, in RevenueCat's offering as
 * the Lifetime package. The price shown always comes from the store; `usd`
 * is what to set there.
 */
export const LIFETIME = { enabled: true, product: 'sweatbook_lifetime', usd: 499 };

/**
 * High-stakes features that need Pro (Rui, 17 Oct: "Sim, Pro"). Fixed from
 * launch: after launch a feature may go from Pro to free, never the other way.
 * The shared sides stay free (a backer's page, confirming a swap by link).
 */
export const PRO_ONLY = {
  /** Backers, makeup and settling up (staking screens). */
  staking: true,
  /** Swap settlement: who owes whom, the group's minimum transfers and the history breakdowns. Creating, sharing and recording results stay free. */
  swaps: true,
  /** The yearly report with tax per country (PDF export). */
  taxReport: true,
  /** Net worth and results across currencies in one total (bankroll). */
  homeTotal: true,
  /** "Onde ganhas e onde perdes" and the mental journal's cards: the patterns in the player's sessions. Check-ins stay free. */
  insights: true,
  /** "É normal?" on Downswings: the read on the player's own variance. The downswing numbers and chart stay free. */
  downswingRead: true,
  /** Win rate by game, stake, venue and weekday, and how many hours until it is known. The headline win rate stays free. */
  winrateDetail: true,
  monthCompare: true,
  moveUpPlan: true,
  /** Drawing villain's range on the 13×13 grid in the replayer. Equity against the range read from the preflop raises stays free. */
  villainRange: true,
};
export type ProFeature = keyof typeof PRO_ONLY;

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

export type PaywallReason = 'hands' | 'handsLive' | ProFeature | 'shares' | 'stats' | 'story' | 'solver' | 'coach' | 'welcome' | 'plan' | 'views' | 'bigWin' | 'sessionStart' | 'sessionEnd' | 'generic';

/** Headline per trigger: the paywall talks about what the player just tried to do. One idea per line. */
export const PAYWALL_COPY: Record<PaywallReason, { title: string; body: string }> = {
  hands: {
    title: t('Mão guardada como rascunho'),
    body: t('Com Pro, guardas mãos sem limite.'),
  },
  staking: {
    title: t('Staking sem folhas de cálculo'),
    body: t('Backers, makeup e acertos, sempre certos.'),
  },
  swaps: {
    title: t('Swaps acertados sozinhos'),
    body: t('Percentagens, prémios e quem deve a quem.'),
  },
  taxReport: {
    title: t('O relatório do ano, pronto'),
    body: t('Resultados por país e imposto retido, em PDF.'),
  },
  homeTotal: {
    title: t('Tudo numa moeda'),
    body: t('Património e resultado do ano, ao câmbio de cada dia.'),
  },
  insights: {
    title: t('Onde ganhas e onde perdes'),
    body: t('Salas, stakes, horas, sono e tilt: o que mexe no teu resultado.'),
  },
  downswingRead: {
    title: t('Azar ou sinal?'),
    body: t('Vê se o teu downswing é normal para os teus resultados.'),
  },
  sessionStart: {
    title: t('Começa o teu Pro com esta sessão'),
    body: t('Os dias grátis contam a partir de hoje, à mesa.'),
  },
  sessionEnd: {
    title: t('Cada sessão, toda revista'),
    body: t('Mãos sem limite, e em que sala e stake ganhas mais.'),
  },
  handsLive: {
    title: t('A sessão continua'),
    body: t('Guarda esta mão e as próximas sem limite.'),
  },
  views: {
    title: t('A tua mão está a ser vista'),
    body: t('Com Pro, guardas e partilhas todas as mãos da sessão.'),
  },
  bigWin: {
    title: t('Vê de onde vem o teu lucro'),
    body: t('Salas, jogos e stakes, com filtros e CSV.'),
  },
  winrateDetail: {
    title: t('Sabe onde o teu win rate é real'),
    body: t('Por jogo, stake, sala e dia, com a margem de erro de cada um.'),
  },
  monthCompare: {
    title: t('Este mês foi melhor?'),
    body: t('Compara cada mês com os anteriores e vê onde ganhaste.'),
  },
  villainRange: {
    title: t('Desenha a range do vilão'),
    body: t('Escolhe as mãos dele na grelha e vê a tua equity contra elas.'),
  },
  moveUpPlan: {
    title: t('Decide a stake com os teus números'),
    body: t('Risco de ruína com o teu win rate, e um plano com o ponto em que voltas atrás.'),
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
  coach: {
    title: t('Revê as mãos com o teu coach'),
    body: t('Com Pro, envias ao coach todas as pastas e mãos que quiseres.'),
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

export type FeatureKey = 'hands' | 'story' | 'stats' | 'solver' | 'coach' | ProFeature;

/** The first three are the generic rows; the rest lead only when they triggered the paywall. */
export const PRO_FEATURES: { key: FeatureKey; icon: string; title: string; body: string }[] = [
  { key: 'hands', icon: 'infinite', title: t('Mãos ilimitadas'), body: t('Sem limite diário') },
  { key: 'stats', icon: 'stats-chart', title: t('Bankroll completo'), body: t('Várias bankrolls, filtros, CSV') },
  { key: 'story', icon: 'mic', title: t('Stories com voz'), body: t('Sem marca de água') },
  { key: 'solver', icon: 'analytics', title: t('Mãos para o solver'), body: t('Várias de uma vez') },
  { key: 'coach', icon: 'school', title: t('Revisão com coach'), body: t('Pastas e mãos sem limite') },
  { key: 'staking', icon: 'people', title: t('Staking'), body: t('Backers, makeup, acertos') },
  { key: 'swaps', icon: 'swap-horizontal', title: t('Swaps'), body: t('Quem deve a quem') },
  { key: 'taxReport', icon: 'document-text', title: t('Relatório do ano'), body: t('Por país, com imposto') },
  { key: 'homeTotal', icon: 'globe', title: t('Tudo numa moeda'), body: t('Ao câmbio de cada dia') },
  { key: 'insights', icon: 'bulb', title: t('Onde ganhas e onde perdes'), body: t('Salas, stakes, sono e tilt') },
  { key: 'downswingRead', icon: 'pulse', title: t('Azar ou sinal?'), body: t('O teu downswing é normal?') },
];

const LEADS: Partial<Record<PaywallReason, FeatureKey>> = {
  hands: 'hands',
  handsLive: 'hands',
  sessionStart: 'hands',
  sessionEnd: 'hands',
  welcome: 'hands',
  views: 'hands',
  stats: 'stats',
  bigWin: 'stats',
  story: 'story',
  solver: 'solver',
  coach: 'coach',
  staking: 'staking',
  swaps: 'swaps',
  taxReport: 'taxReport',
  homeTotal: 'homeTotal',
  insights: 'insights',
  downswingRead: 'downswingRead',
};

/** Three rows: the feature the player just reached for first, then generic ones. */
export function featuresFor(reason: PaywallReason): { feature: (typeof PRO_FEATURES)[number]; highlight: boolean }[] {
  const key = LEADS[reason] ?? null;
  const first = PRO_FEATURES.filter((f) => f.key === key);
  const generic = PRO_FEATURES.slice(0, 3).filter((f) => f.key !== key);
  return [...first, ...generic].slice(0, 3).map((feature) => ({ feature, highlight: feature.key === key }));
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
    { label: 'Torneios por buy-in, festival e jogo', free: false, pro: true },
    { label: 'Staking e swaps', free: !PRO_ONLY.staking, pro: true },
    { label: 'Total em todas as moedas', free: !PRO_ONLY.homeTotal, pro: true },
    { label: 'Onde ganhas e onde perdes', free: !PRO_ONLY.insights, pro: true },
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
