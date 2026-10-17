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
      nav: { how: 'How it works', pricing: 'Pricing' },
      get: 'Get the app',
      eyebrow: 'For live poker players',
      heroTitle: ['Log the hand', 'before the next deal.'],
      heroBody: 'Save a hand in a few taps at the table. Replay it on break. Send it to friends for their read.',
      ctaFree: 'Download free',
      soon: 'Coming soon on',
      soonPlay: 'Coming soon on',
      getOn: 'Download on',
      getOnPlay: 'Get it on',
      tryDemo: 'See a shared hand',
      heroNote: `Free · ${PRICES.freeHandsPerDay} hands a day · No account`,
      mock: { session: 'Tournament · 1,000/2,000', street: 'Turn', pot: 'Pot 41,000', you: 'You', fold: 'Fold', call: 'Call 18,500' },
      proof: [
        ['No account', 'Open and play'],
        ['On your phone', 'Your hands stay yours'],
        ['One link', 'Friends need no app'],
      ],
      howTitle: 'Built for the table',
      how: [
        ['At the table', 'Save it in seconds', 'Blinds, level and stacks come from your session. Tap who entered the pot, done.'],
        ['On break', 'Replay street by street', 'The table, bets in big blinds and your notes, one street at a time.'],
        ['After', 'Ask for a read', 'A link for WhatsApp or a story for Instagram. Friends vote and comment in the browser.'],
      ],
      shareTitle: 'Your friends get a challenge',
      shareSub: 'The link stops at your decision. They vote first, then see what you did and comment on the exact street.',
      handMeta: 'Estoril Poker Series €550 · Bubble',
      handQ: 'Villain shoves the turn. What do you do?',
      votes: ['Fold', 'Call'],
      shareCta: 'Try the challenge',
      pricingTitle: 'Free to start',
      pricingSub: 'Pro is for players who save every hand of the tournament.',
      annual: 'Annual',
      monthly: 'Monthly',
      save: `−${saving}%`,
      free: 'Free',
      freePrice: '$0',
      freePeriod: 'forever',
      freeFeatures: [
        `${PRICES.freeHandsPerDay} saved hands a day`,
        'Full replayer',
        'Share links with votes and comments',
        'Sessions, bankroll and player notes',
      ],
      freeCta: 'Start free',
      proTag: `${PRICES.trialDays} days free`,
      proFeatures: [
        'Unlimited hands',
        'Instagram stories with your voice, no watermark',
        'Full bankroll: 30 days, 90 days, year, ROI and ITM',
        'Everything in Free',
      ],
      plan: {
        annual: {
          price: m(PRICES.annual),
          period: '/ year',
          note: `${m(perMonth)} a month`,
          cta: `Try ${PRICES.trialDays} days free`,
          fine: `Free for ${PRICES.trialDays} days, then ${m(PRICES.annual)} a year. Renews until you cancel in the App Store or Google Play.`,
        },
        monthly: {
          price: m(PRICES.monthly),
          period: '/ month',
          note: 'Cancel any time',
          cta: 'Get Pro',
          fine: `${m(PRICES.monthly)} a month. Renews until you cancel in the App Store or Google Play.`,
        },
      },
      storeOnly: 'You subscribe in the app, through the App Store or Google Play.',
      faqTitle: 'Questions',
      faq: [
        ['What happens to my 4th hand of the day on Free?', 'It stays as a draft on your phone. Save it tomorrow, or go Pro and save it now.'],
        ['Do my friends need the app?', 'No. The link opens in any browser: they watch the replay, vote and comment.'],
        ['Can I cancel whenever I want?', 'Yes, in App Store or Google Play settings. Pro stays on until the end of the period you paid.'],
        ['If I stop paying, do I lose my hands?', `No. Every saved hand stays yours. You go back to ${PRICES.freeHandsPerDay} new hands a day.`],
        ['Is this a gambling app?', 'No. Sweatbook is for logging and studying the hands you play live. There is no betting inside the app.'],
      ],
      finalTitle: 'Next hand you play, save it.',
      privacy: 'Privacy',
      terms: 'Terms',
      support: 'Support',
      invite: {
        eyebrow: 'Invite',
        title: 'A friend invited you to Sweatbook',
        body: `Install the app and save your first hand. You both get ${REWARD_DAYS_PUBLIC} days of Pro.`,
        code: 'Your invite code',
        copy: 'Copy',
        copied: 'Copied',
        days: 'days of Pro\nfor each of you',
        steps: ['Install Sweatbook', 'Open this link again, or type the code', 'Save your first hand'],
        open: 'Already installed? Open in the app',
        more: 'What is Sweatbook?',
      },
    };
  }
  return {
    nav: { how: 'Como funciona', pricing: 'Preços' },
    get: 'Obter app',
    eyebrow: 'Para quem joga ao vivo',
    heroTitle: ['Grava a mão', 'antes do próximo deal.'],
    heroBody: 'Guarda a mão em poucos toques à mesa. Revê-a no intervalo. Manda-a aos amigos para te darem a opinião.',
    ctaFree: 'Descarregar grátis',
    soon: 'Em breve na',
    soonPlay: 'Em breve no',
    getOn: 'Descarregar na',
    getOnPlay: 'Disponível no',
    tryDemo: 'Ver uma mão partilhada',
    heroNote: `Grátis · ${PRICES.freeHandsPerDay} mãos por dia · Sem conta`,
    mock: { session: 'Torneio · 1.000/2.000', street: 'Turn', pot: 'Pote 41.000', you: 'Tu', fold: 'Fold', call: 'Call 18.500' },
    proof: [
      ['Sem conta', 'Abres e jogas'],
      ['No teu telemóvel', 'As mãos são tuas'],
      ['Um link', 'Os amigos não precisam da app'],
    ],
    howTitle: 'Feito para a mesa',
    how: [
      ['À mesa', 'Guarda em segundos', 'Blinds, nível e stacks vêm da sessão. Tocas em quem entrou no pote e está feito.'],
      ['No intervalo', 'Revê rua a rua', 'A mesa, as apostas em big blinds e as tuas notas, uma rua de cada vez.'],
      ['Depois', 'Pede opinião', 'Um link para o WhatsApp ou uma story para o Instagram. Os amigos votam e comentam no browser.'],
    ],
    shareTitle: 'Os teus amigos recebem um desafio',
    shareSub: 'O link pára na tua decisão. Votam primeiro, depois veem o que fizeste e comentam na rua exata.',
    handMeta: 'Estoril Poker Series €550 · Bolha',
    handQ: 'O vilão faz shove no turn. O que fazias?',
    votes: ['Fold', 'Call'],
    shareCta: 'Experimentar o desafio',
    pricingTitle: 'Grátis para começar',
    pricingSub: 'O Pro é para quem guarda todas as mãos do torneio.',
    annual: 'Anual',
    monthly: 'Mensal',
    save: `−${saving}%`,
    free: 'Grátis',
    freePrice: '0 US$',
    freePeriod: 'para sempre',
    freeFeatures: [
      `${PRICES.freeHandsPerDay} mãos guardadas por dia`,
      'Replayer completo',
      'Partilha por link com votos e comentários',
      'Sessões, bankroll e notas de jogadores',
    ],
    freeCta: 'Começar grátis',
    proTag: `${PRICES.trialDays} dias grátis`,
    proFeatures: [
      'Mãos ilimitadas',
      'Stories do Instagram com a tua voz, sem marca de água',
      'Bankroll completo: 30 dias, 90 dias, ano, ROI e ITM',
      'Tudo o que o Grátis tem',
    ],
    plan: {
      annual: {
        price: m(PRICES.annual),
        period: '/ ano',
        note: `${m(perMonth)} por mês`,
        cta: `Experimentar ${PRICES.trialDays} dias grátis`,
        fine: `Grátis durante ${PRICES.trialDays} dias, depois ${m(PRICES.annual)} por ano. Renova até cancelares na App Store ou no Google Play.`,
      },
      monthly: {
        price: m(PRICES.monthly),
        period: '/ mês',
        note: 'Cancela quando quiseres',
        cta: 'Subscrever Pro',
        fine: `${m(PRICES.monthly)} por mês. Renova até cancelares na App Store ou no Google Play.`,
      },
    },
    storeOnly: 'A subscrição faz-se na app, pela App Store ou pelo Google Play.',
    faqTitle: 'Perguntas',
    faq: [
      ['O que acontece à 4.ª mão do dia no plano Grátis?', 'Fica como rascunho no telemóvel. Guardas amanhã, ou passas a Pro e guardas já.'],
      ['Os meus amigos precisam da app?', 'Não. O link abre em qualquer browser: veem o replay, votam e comentam.'],
      ['Posso cancelar quando quiser?', 'Sim, nas definições da App Store ou do Google Play. Ficas com Pro até ao fim do período pago.'],
      ['Se deixar de pagar, perco as mãos?', `Não. Todas as mãos guardadas continuam tuas. Voltas às ${PRICES.freeHandsPerDay} mãos novas por dia.`],
      ['É uma app de jogo a dinheiro?', 'Não. O Sweatbook serve para registar e estudar as mãos que jogas ao vivo. Não há apostas dentro da app.'],
    ],
    finalTitle: 'Na próxima mão que jogares, guarda-a.',
    privacy: 'Privacidade',
    terms: 'Termos',
    support: 'Suporte',
    invite: {
      eyebrow: 'Convite',
      title: 'Um amigo convidou-te para o Sweatbook',
      body: `Instala a app e guarda a tua primeira mão. Ganham os dois ${REWARD_DAYS_PUBLIC} dias de Pro.`,
      code: 'O teu código de convite',
      copy: 'Copiar',
      copied: 'Copiado',
      days: 'dias de Pro\npara cada um',
      steps: ['Instala o Sweatbook', 'Abre outra vez este link, ou escreve o código', 'Guarda a tua primeira mão'],
      open: 'Já instalaste? Abrir na app',
      more: 'O que é o Sweatbook?',
    },
  };
}

export type LandingCopy = ReturnType<typeof landingCopy>;
