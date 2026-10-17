import type { Locale } from '@/lib/i18n';

// Prices and plan limits mirror the paywall (RevenueCat products sweatbook_pro_monthly / _annual).
export const PRICES = {
  monthly: 29.99,
  annual: 199.99,
  trialDays: 7,
  freeHandsPerDay: 3,
};

/** Mirrors REWARD_DAYS in lib/referrals.ts (server-only). */
export const REWARD_DAYS_PUBLIC = 7;

const money = (n: number, locale: Locale) =>
  locale === 'pt' ? `${n.toFixed(2).replace('.', ',')} US$` : `$${n.toFixed(2)}`;

const perMonth = PRICES.annual / 12;
const saving = Math.round((1 - PRICES.annual / (PRICES.monthly * 12)) * 100);

export function landingCopy(locale: Locale) {
  const m = (n: number) => money(n, locale);
  if (locale === 'en') {
    return {
      nav: { how: 'How it works', pricing: 'Pricing', faq: 'FAQ' },
      heroTitle: ['Log the hand', 'before the next deal.'],
      heroBody:
        'Sweatbook is the notebook for live poker players. Save a hand in seconds at the table, replay it street by street and send the link to your friends. They vote and comment in the browser, no install needed.',
      soon: 'Coming soon on',
      soonPlay: 'Coming soon on',
      getOn: 'Download on',
      getOnPlay: 'Get it on',
      tryDemo: 'Try a shared hand',
      heroNote: 'Free to start. No real-money gambling.',
      handMeta: 'Estoril Poker Series €550 · Bubble · Level 14 · 58 left',
      handPot: 'Pot 41,000 · 20 BB',
      handQ: 'Turn, villain shoves. What do you do?',
      handVote: 'Vote on this hand',
      votes: ['Fold', 'Call', 'Tank'],
      howTitle: 'Built for live players',
      howSub: 'No card keyboard mid-hand and no 40 taps. Tournament context comes from your session.',
      how: [
        ['At the table', 'Save in seconds', 'Blinds, level, stacks and seats come from the session. Just tap who entered the pot.'],
        ['On break', 'Replay street by street', 'A replayer with the table, bets in BB and your notes. Fill in the rest when you have time.'],
        ['After', 'Ask for feedback', 'A link for WhatsApp or a story for Instagram. Friends vote and comment without the app.'],
      ],
      shareTitle: 'Your friends see it like this',
      shareSub: 'The link opens the replayer in any browser. They vote before seeing what you did, then comment on the exact street.',
      shareCta: 'Open the example hand',
      pricingTitle: 'Try it free. Go Pro when the session asks for more.',
      pricingSub: 'The free plan is enough to get to know the app. Pro is for players who save every hand of the tournament.',
      annual: 'Annual',
      monthly: 'Monthly',
      save: `−${saving}%`,
      free: 'Free',
      freePrice: '$0',
      freePeriod: 'forever',
      freeNote: 'No card required.',
      freeFeatures: [
        `${PRICES.freeHandsPerDay} saved hands per day`,
        'Full replayer',
        'Link sharing with votes and comments',
        'Sessions, bankroll and player notes',
        'Instagram story with watermark',
      ],
      freeMissing: ['Bankroll filters by period'],
      freeCta: 'Start free',
      proTag: `${PRICES.trialDays} days free`,
      proFeatures: [
        'Unlimited hands',
        'Stories with your voice, no watermark',
        'Full bankroll: 30 days, 90 days, year, ROI and ITM',
        'Everything in the free plan',
      ],
      plan: {
        annual: {
          price: m(PRICES.annual),
          period: '/ year',
          note: `Works out to ${m(perMonth)} a month.`,
          cta: `Try ${PRICES.trialDays} days free`,
          fine: `Free for ${PRICES.trialDays} days, then ${m(PRICES.annual)} per year. Renews automatically until you cancel in the App Store or Google Play.`,
        },
        monthly: {
          price: m(PRICES.monthly),
          period: '/ month',
          note: 'Cancel any time.',
          cta: 'Get Pro',
          fine: `${m(PRICES.monthly)} per month. Renews automatically until you cancel in the App Store or Google Play.`,
        },
      },
      storeOnly: 'You subscribe inside the app, through the App Store or Google Play.',
      faqTitle: 'Questions',
      faq: [
        ['What happens to my 4th hand of the day on the free plan?', 'It stays as a draft on your phone. You lose nothing: save it tomorrow, or go Pro and save it now.'],
        ['Do my friends need the app to see the hand?', 'No. They open the link in the browser, watch the replay, vote and comment. If they like it, they install.'],
        ['Can I cancel whenever I want?', 'Yes, in App Store or Google Play settings. You keep Pro until the end of the period you already paid.'],
        ['If I stop being Pro, do I lose my hands?', `No. Every saved hand stays yours. You just go back to ${PRICES.freeHandsPerDay} new hands per day.`],
        ['Is this a gambling app?', 'No. Sweatbook is for logging and studying the hands you play live. There is no betting or gaming inside the app.'],
      ],
      finalTitle: 'Next hand you play, save it.',
      privacy: 'Privacy',
      terms: 'Terms',
      support: 'Support',
    };
  }
  return {
    nav: { how: 'Como funciona', pricing: 'Preços', faq: 'Perguntas' },
    heroTitle: ['Grava a mão', 'antes do próximo deal.'],
    heroBody:
      'O Sweatbook é o caderno do jogador de póquer live. Guardas a mão em segundos à mesa, revês rua a rua no replayer e mandas o link aos amigos. Eles votam e comentam no browser, sem instalar nada.',
    soon: 'Em breve na',
    soonPlay: 'Em breve no',
    getOn: 'Descarregar na',
    getOnPlay: 'Disponível no',
    tryDemo: 'Experimenta uma mão partilhada',
    heroNote: 'Grátis para começar. Sem jogo a dinheiro real.',
    handMeta: 'Estoril Poker Series €550 · Bolha · Nível 14 · 58 restantes',
    handPot: 'Pote 41.000 · 20 BB',
    handQ: 'Turn, o vilão faz shove. O que fazias aqui?',
    handVote: 'Votar nesta mão',
    votes: ['Fold', 'Call', 'Pensar'],
    howTitle: 'Feito para quem joga ao vivo',
    howSub: 'Sem teclado de cartas a meio da mão nem 40 toques. O contexto do torneio já vem preenchido da tua sessão.',
    how: [
      ['À mesa', 'Guarda em segundos', 'Blinds, nível, stack e quem está sentado vêm da sessão. Só tocas em quem entrou no pote.'],
      ['No intervalo', 'Revê rua a rua', 'Replayer com a mesa, as apostas em BB e as tuas notas. Completa o resto quando tiveres tempo.'],
      ['Depois', 'Pede opinião', 'Um link para o WhatsApp ou uma story para o Instagram. Os amigos votam e comentam sem app.'],
    ],
    shareTitle: 'É assim que os teus amigos a veem',
    shareSub: 'O link abre o replayer em qualquer browser. Votam antes de ver o que fizeste e depois comentam na rua exata.',
    shareCta: 'Abrir a mão de exemplo',
    pricingTitle: 'Experimenta grátis. Passa a Pro quando a sessão pedir mais.',
    pricingSub: 'O plano grátis chega para conheceres a app. O Pro é para quem guarda todas as mãos do torneio.',
    annual: 'Anual',
    monthly: 'Mensal',
    save: `−${saving}%`,
    free: 'Grátis',
    freePrice: '0 US$',
    freePeriod: 'para sempre',
    freeNote: 'Sem cartão.',
    freeFeatures: [
      `${PRICES.freeHandsPerDay} mãos guardadas por dia`,
      'Replayer completo',
      'Partilha por link com votos e comentários',
      'Sessões, bankroll e notas de jogadores',
      'Story para o Instagram com marca de água',
    ],
    freeMissing: ['Filtros de bankroll por período'],
    freeCta: 'Começar grátis',
    proTag: `${PRICES.trialDays} dias grátis`,
    proFeatures: [
      'Mãos ilimitadas',
      'Stories com a tua voz, sem marca de água',
      'Bankroll completo: 30 dias, 90 dias, ano, ROI e ITM',
      'Tudo o que o plano grátis tem',
    ],
    plan: {
      annual: {
        price: m(PRICES.annual),
        period: '/ ano',
        note: `Fica a ${m(perMonth)} por mês.`,
        cta: `Experimentar ${PRICES.trialDays} dias grátis`,
        fine: `Grátis durante ${PRICES.trialDays} dias, depois ${m(PRICES.annual)} por ano. Renova automaticamente até cancelares na App Store ou no Google Play.`,
      },
      monthly: {
        price: m(PRICES.monthly),
        period: '/ mês',
        note: 'Cancela quando quiseres.',
        cta: 'Subscrever Pro',
        fine: `${m(PRICES.monthly)} por mês. Renova automaticamente até cancelares na App Store ou no Google Play.`,
      },
    },
    storeOnly: 'A subscrição faz-se dentro da app, pela App Store ou pelo Google Play.',
    faqTitle: 'Perguntas',
    faq: [
      ['O que acontece à 4.ª mão do dia no plano grátis?', 'Fica guardada como rascunho no telemóvel. Não perdes nada: guardas amanhã ou passas a Pro e guardas logo.'],
      ['Os meus amigos precisam da app para ver a mão?', 'Não. Abrem o link no browser, veem o replay, votam e comentam. Se gostarem, instalam.'],
      ['Posso cancelar quando quiser?', 'Sim, nas definições da App Store ou do Google Play. Ficas com Pro até ao fim do período que já pagaste.'],
      ['Se deixar de ser Pro, perco as mãos?', `Não. Todas as mãos guardadas continuam tuas. Só voltas ao limite de ${PRICES.freeHandsPerDay} mãos novas por dia.`],
      ['É uma app de jogo a dinheiro?', 'Não. O Sweatbook serve para registar e estudar as mãos que jogas ao vivo. Não há apostas nem jogo dentro da app.'],
    ],
    finalTitle: 'Na próxima mão que jogares, guarda-a.',
    privacy: 'Privacidade',
    terms: 'Termos',
    support: 'Suporte',
  };
}

export type LandingCopy = ReturnType<typeof landingCopy>;
