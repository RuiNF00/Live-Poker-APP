import { localeFormat, moneyIn, type LocaleFormat, type MoneyVariant } from '@livepoker/hand-format';

export type Locale = 'pt' | 'pt-BR' | 'en' | 'es';

export const LOCALES: readonly Locale[] = ['pt', 'pt-BR', 'en', 'es'];

export const isLocale = (v: unknown): v is Locale => typeof v === 'string' && (LOCALES as readonly string[]).includes(v);

/** Both Portuguese variants (for grammar and layout choices shared by pt-PT and pt-BR). */
export const isPt = (l: Locale): l is 'pt' | 'pt-BR' => l === 'pt' || l === 'pt-BR';

/**
 * The language of a link preview. The app adds the sharer's language to every link it shares
 * (?lang=pt-PT), because WhatsApp, Telegram and Instagram fetch the preview without one; without it,
 * the reader's browser decides, as for the page itself.
 */
export function previewLocale(lang: unknown, acceptLanguage: string | null | undefined): Locale {
  const t = typeof lang === 'string' ? lang.trim().toLowerCase().replace('_', '-') : '';
  if (t === 'pt-br') return 'pt-BR';
  if (t === 'pt-pt' || t === 'pt') return 'pt';
  if (t === 'es') return 'es';
  if (t === 'en') return 'en';
  return pickLocale(acceptLanguage);
}

/** og:locale (pt_PT): chat apps use it to pick fonts and text direction. */
export function ogLocale(l: Locale): string {
  return l === 'pt' ? 'pt_PT' : l === 'pt-BR' ? 'pt_BR' : l === 'es' ? 'es_ES' : 'en_GB';
}

/** BCP 47 tag for dates and times (Intl / toLocale*String). */
export function intlTag(l: Locale): string {
  return l === 'pt' ? 'pt-PT' : l === 'pt-BR' ? 'pt-BR' : l === 'es' ? 'es' : 'en-GB';
}

/**
 * Tag for numbers, the same the app uses (CLDR): pt-PT and es-ES group only from five digits
 * (2500, 12 345 / 12.345), pt-BR always (2.500), English with commas.
 */
export function numberTag(l: Locale): string {
  return l === 'pt' ? 'pt-PT' : l === 'pt-BR' ? 'pt-BR' : l === 'es' ? 'es-ES' : 'en-GB';
}

const MONEY_VARIANT: Record<Locale, MoneyVariant> = { pt: 'pt-PT', 'pt-BR': 'pt-BR', en: 'en', es: 'es' };
const moneyFormats = new Map<Locale, LocaleFormat>();

/** The app's number rules for a page language (decimal comma, grouping, money layout). */
export function numberFormat(l: Locale): LocaleFormat {
  let f = moneyFormats.get(l);
  if (!f) moneyFormats.set(l, (f = localeFormat(MONEY_VARIANT[l])));
  return f;
}

/**
 * Money exactly as the app writes it (same rules, packages/hand-format/src/money.ts): "2500€" and
 * "12,50€" in pt-PT, "R$ 2.500" in pt-BR, "2500 €" in Spain, "$2,500" in English. `signed` adds a
 * "+" to gains; losses always carry "−".
 */
export function formatMoney(n: number, currency: string, l: Locale, signed = false): string {
  const f = numberFormat(l);
  const s = moneyIn(f, n, currency);
  return signed && n > 0 && s !== moneyIn(f, 0, currency) ? `+${s}` : s;
}

/**
 * Picks the page language from Accept-Language: the first supported language in the visitor's
 * order of preference wins (pt-BR, other Portuguese, Spanish, English); anything else gets English.
 */
export function pickLocale(acceptLanguage: string | null | undefined): Locale {
  // No header at all (link-preview bots): the site's own language, as before.
  const m = matchLocale(acceptLanguage);
  return m ?? (m === null ? 'en' : 'pt');
}

/**
 * A shared page's language: the reader's phone when it asks for one of ours; otherwise the
 * sharer's (?lang=), so a reader whose phone is in French sees the player's language, not English.
 */
export function pageLocale(lang: unknown, acceptLanguage: string | null | undefined): Locale {
  return matchLocale(acceptLanguage) ?? previewLocale(lang, acceptLanguage);
}

/** The visitor's first supported language; null when they list only others, undefined when they list none. */
function matchLocale(acceptLanguage: string | null | undefined): Locale | null | undefined {
  const prefs = (acceptLanguage || '')
    .split(',')
    .map((part, i) => {
      const [tag, ...params] = part.trim().toLowerCase().split(';');
      const qp = params.map((x) => x.trim()).find((x) => x.startsWith('q='));
      const q = qp ? Number(qp.slice(2)) : 1;
      return { tag: tag.trim(), q: Number.isFinite(q) ? q : 0, i };
    })
    .filter((p) => p.tag && p.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  for (const { tag } of prefs) {
    if (tag === 'pt-br' || tag.startsWith('pt-br-')) return 'pt-BR';
    if (tag === 'pt' || tag.startsWith('pt-')) return 'pt';
    if (tag === 'es' || tag.startsWith('es-')) return 'es';
    if (tag === 'en' || tag.startsWith('en-')) return 'en';
  }
  return prefs.length ? null : undefined;
}

const pt = {
  stepLabel: 'Posição na mão',
  sharedBy: 'Mão partilhada',
  level: 'Nível',
  playersLeft: 'restantes',
  paid: 'pagos',
  stage: {
    early: 'Início',
    middle: 'Meio',
    late: 'Fase final',
    bubble: 'Bolha',
    itm: 'Nos prémios',
    final_table: 'Mesa final',
    heads_up: 'Heads-up',
  },
  cash: 'Cash game',
  tournament: 'Torneio',
  prev: 'Anterior',
  next: 'Seguinte',
  play: 'Reproduzir',
  pause: 'Pausa',
  speed: 'Velocidade',
  restart: 'Recomeçar',
  end: 'Fim',
  showBB: 'Ver em BB',
  showChips: 'Ver em fichas',
  pot: 'Pote',
  comments: 'Comentários',
  noComments: 'Ainda sem comentários. Diz o que achas da jogada.',
  yourName: 'O teu nome',
  nameOptional: 'O teu nome (opcional)',
  anonymous: 'Anónimo',
  commentPlaceholder: 'Como jogavas esta mão?',
  attachToStep: 'Ligar ao momento atual',
  wholeHand: 'A mão toda',
  youAreHere: 'Estás aqui',
  noStreetComments: 'Ainda nada sobre esta rua. Comenta em baixo.',
  send: 'Comentar',
  sending: 'A enviar…',
  commentTerms: 'Ao comentar aceitas os',
  commentTermsLink: 'Termos',
  termsHref: '/terms#pt',
  commentError: 'Não foi possível enviar. Tenta outra vez.',
  commentBlocked: 'Não foi possível enviar o comentário.',
  rateLimited: 'Muitos comentários seguidos. Espera um minuto.',
  offensive: 'O comentário tem linguagem ofensiva. Reescreve-o, por favor.',
  report: 'Denunciar',
  reported: 'Denunciado. Obrigado.',
  reportHand: 'Denunciar esta mão',
  voteToSeeComments: 'Vota primeiro no que fazias. Depois vês os comentários e a jogada.',
  at: 'em',
  quizTitle: 'O que fazias aqui?',
  quizFacing: 'A pagar',
  quizThanks: 'Votaste. Vê o que o jogador fez.',
  quizSame: (a: string) => `O jogador também fez ${a}. Pensam igual.`,
  quizDiff: (a: string) => `O jogador fez ${a}. Quem tem razão?`,
  quizVotes: 'votos',
  quizVote: 'voto',
  quizContinue: 'Ver a jogada',
  quizSkip: 'Saltar e ver',
  quizAnswered: (n: number) => (n === 1 ? '1 pessoa já respondeu' : `${n} pessoas já responderam`),
  quizFirst: 'Sê o primeiro a responder',
  quizTop: (pct: number, a: string) => `${pct}% ${a}`,
  quizWithMost: 'Estás com a maioria. E o jogador?',
  quizAgainstMost: 'Foste contra a maioria. E o jogador?',
  ctaTitle: 'Registas mãos no live?',
  ctaBody: 'Grava a mão em 10 segundos entre jogadas e partilha-a com os amigos para teres feedback.',
  ctaDownload: 'Descarregar app',
  endTitle: 'E tu, como jogavas?',
  endComment: 'Comentar',
  endApp: 'Quero a app',
  ctaInvite: (pct: number) => `Vens por convite: instala, guarda a tua primeira mão e recebem os dois ${pct}% no primeiro mês do Pro.`,
  openInApp: 'Abrir na app',
  comingSoon: 'Em breve na App Store e Google Play',
  notFound: 'Esta mão já não existe.',
  invalid: 'Esta mão tem dados inválidos e não pode ser reproduzida.',
  views: (n: number): string => (n === 1 ? 'visualização' : 'visualizações'),
  copyLink: 'Copiar link',
  copied: 'Link copiado',
  copyManual: 'Copia o link:',
  revealError: 'Não foi possível carregar o resto da mão.',
  retry: 'Tentar outra vez',
  shareNative: 'Partilhar',
  notes: 'Notas',
  hero: 'Hero',
  log: 'Ação',
  winner: 'ganha',
  justNow: 'agora',
  minutesAgo: (n: number) => `há ${n} min`,
  hoursAgo: (n: number) => `há ${n} h`,
  daysAgo: (n: number) => `há ${n} d`,
};

export type Dict = typeof pt;

const en: Dict = {
  stepLabel: 'Position in the hand',
  sharedBy: 'Shared hand',
  level: 'Level',
  playersLeft: 'left',
  paid: 'paid',
  stage: {
    early: 'Early',
    middle: 'Middle',
    late: 'Late',
    bubble: 'Bubble',
    itm: 'In the money',
    final_table: 'Final table',
    heads_up: 'Heads-up',
  },
  cash: 'Cash game',
  tournament: 'Tournament',
  prev: 'Previous',
  next: 'Next',
  play: 'Play',
  pause: 'Pause',
  speed: 'Speed',
  restart: 'Restart',
  end: 'End',
  showBB: 'Show in BB',
  showChips: 'Show chips',
  pot: 'Pot',
  comments: 'Comments',
  noComments: 'No comments yet. Say how you would play it.',
  yourName: 'Your name',
  nameOptional: 'Your name (optional)',
  anonymous: 'Anonymous',
  commentPlaceholder: 'How would you play this hand?',
  attachToStep: 'Attach to this moment',
  wholeHand: 'The whole hand',
  youAreHere: 'You are here',
  noStreetComments: 'Nothing on this street yet. Comment below.',
  send: 'Comment',
  sending: 'Sending…',
  commentTerms: 'By commenting you accept the',
  commentTermsLink: 'Terms',
  termsHref: '/terms',
  commentError: 'Could not send. Try again.',
  commentBlocked: "Couldn't send the comment.",
  rateLimited: 'Too many comments in a row. Wait a minute.',
  offensive: 'This comment contains offensive language. Please rewrite it.',
  report: 'Report',
  reported: 'Reported. Thank you.',
  reportHand: 'Report this hand',
  voteToSeeComments: 'Vote on your play first. Then you see the comments and what happened.',
  at: 'at',
  quizTitle: 'What do you do here?',
  quizFacing: 'To call',
  quizThanks: 'Vote counted. See what the player did.',
  quizSame: (a: string) => `The player also went ${a}. Great minds.`,
  quizDiff: (a: string) => `The player went ${a}. Who's right?`,
  quizVotes: 'votes',
  quizVote: 'vote',
  quizContinue: 'See the play',
  quizSkip: 'Skip and see',
  quizAnswered: (n: number) => (n === 1 ? '1 person has answered' : `${n} people have answered`),
  quizFirst: 'Be the first to answer',
  quizTop: (pct: number, a: string) => `${pct}% ${a}`,
  quizWithMost: 'You went with the crowd. And the player?',
  quizAgainstMost: 'You went against the crowd. And the player?',
  ctaTitle: 'Playing live?',
  ctaBody: 'Log a hand in 10 seconds between orbits and share it with friends for feedback.',
  ctaDownload: 'Get the app',
  endTitle: 'How would you play it?',
  endComment: 'Comment',
  endApp: 'Get the app',
  ctaInvite: (pct: number) => `You're invited: install, save your first hand and you both get ${pct}% off your first month of Pro.`,
  openInApp: 'Open in app',
  comingSoon: 'Coming soon to the App Store and Google Play',
  notFound: 'This hand no longer exists.',
  invalid: 'This hand has invalid data and cannot be replayed.',
  views: (n: number) => (n === 1 ? 'view' : 'views'),
  copyLink: 'Copy link',
  copied: 'Link copied',
  copyManual: 'Copy the link:',
  revealError: 'Could not load the rest of the hand.',
  retry: 'Try again',
  shareNative: 'Share',
  notes: 'Notes',
  hero: 'Hero',
  log: 'Action',
  winner: 'wins',
  justNow: 'just now',
  minutesAgo: (n: number) => `${n} min ago`,
  hoursAgo: (n: number) => `${n} h ago`,
  daysAgo: (n: number) => `${n} d ago`,
};

const ptBR: Dict = {
  stepLabel: 'Posição na mão',
  sharedBy: 'Mão compartilhada',
  level: 'Nível',
  playersLeft: 'restantes',
  paid: 'pagos',
  stage: {
    early: 'Início',
    middle: 'Meio',
    late: 'Fase final',
    bubble: 'Bolha',
    itm: 'Nos prêmios',
    final_table: 'Mesa final',
    heads_up: 'Heads-up',
  },
  cash: 'Cash game',
  tournament: 'Torneio',
  prev: 'Anterior',
  next: 'Próximo',
  play: 'Reproduzir',
  pause: 'Pausar',
  speed: 'Velocidade',
  restart: 'Recomeçar',
  end: 'Fim',
  showBB: 'Ver em BB',
  showChips: 'Ver em fichas',
  pot: 'Pote',
  comments: 'Comentários',
  noComments: 'Ainda sem comentários. Diga o que acha da jogada.',
  yourName: 'Seu nome',
  nameOptional: 'Seu nome (opcional)',
  anonymous: 'Anônimo',
  commentPlaceholder: 'Como você jogaria esta mão?',
  attachToStep: 'Vincular ao momento atual',
  wholeHand: 'A mão toda',
  youAreHere: 'Você está aqui',
  noStreetComments: 'Nada sobre esta street ainda. Comente abaixo.',
  send: 'Comentar',
  sending: 'Enviando…',
  commentTerms: 'Ao comentar você aceita os',
  commentTermsLink: 'Termos',
  termsHref: '/terms#pt',
  commentError: 'Não foi possível enviar. Tente de novo.',
  commentBlocked: 'Não foi possível enviar o comentário.',
  rateLimited: 'Muitos comentários seguidos. Espere um minuto.',
  offensive: 'O comentário tem linguagem ofensiva. Reescreva, por favor.',
  report: 'Denunciar',
  reported: 'Denunciado. Obrigado.',
  reportHand: 'Denunciar esta mão',
  voteToSeeComments: 'Vote primeiro no que você faria. Depois você vê os comentários e a jogada.',
  at: 'em',
  quizTitle: 'O que você faria aqui?',
  quizFacing: 'Para pagar',
  quizThanks: 'Voto registrado. Veja o que o jogador fez.',
  quizSame: (a: string) => `O jogador também deu ${a}. Pensaram igual.`,
  quizDiff: (a: string) => `O jogador deu ${a}. Quem tem razão?`,
  quizVotes: 'votos',
  quizVote: 'voto',
  quizContinue: 'Ver a jogada',
  quizSkip: 'Pular e ver',
  quizAnswered: (n: number) => (n === 1 ? '1 pessoa já respondeu' : `${n} pessoas já responderam`),
  quizFirst: 'Seja o primeiro a responder',
  quizTop: (pct: number, a: string) => `${pct}% ${a}`,
  quizWithMost: 'Você está com a maioria. E o jogador?',
  quizAgainstMost: 'Você foi contra a maioria. E o jogador?',
  ctaTitle: 'Você registra mãos no live?',
  ctaBody: 'Salve a mão em 10 segundos entre as jogadas e compartilhe com os amigos para receber feedback.',
  ctaDownload: 'Baixar app',
  endTitle: 'E você, como jogaria?',
  endComment: 'Comentar',
  endApp: 'Quero o app',
  ctaInvite: (pct: number) => `Você veio por convite: instale, salve sua primeira mão e vocês dois recebem ${pct}% no primeiro mês do Pro.`,
  openInApp: 'Abrir no app',
  comingSoon: 'Em breve na App Store e no Google Play',
  notFound: 'Esta mão não existe mais.',
  invalid: 'Esta mão tem dados inválidos e não pode ser reproduzida.',
  views: (n: number) => (n === 1 ? 'visualização' : 'visualizações'),
  copyLink: 'Copiar link',
  copied: 'Link copiado',
  copyManual: 'Copie o link:',
  revealError: 'Não foi possível carregar o resto da mão.',
  retry: 'Tentar de novo',
  shareNative: 'Compartilhar',
  notes: 'Notas',
  hero: 'Hero',
  log: 'Ação',
  winner: 'ganha',
  justNow: 'agora',
  minutesAgo: (n: number) => `há ${n} min`,
  hoursAgo: (n: number) => `há ${n} h`,
  daysAgo: (n: number) => `há ${n} d`,
};

const es: Dict = {
  stepLabel: 'Posición en la mano',
  sharedBy: 'Mano compartida',
  level: 'Nivel',
  playersLeft: 'restantes',
  paid: 'pagados',
  stage: {
    early: 'Inicio',
    middle: 'Mitad',
    late: 'Fase final',
    bubble: 'Burbuja',
    itm: 'En premios',
    final_table: 'Mesa final',
    heads_up: 'Heads-up',
  },
  cash: 'Cash game',
  tournament: 'Torneo',
  prev: 'Anterior',
  next: 'Siguiente',
  play: 'Reproducir',
  pause: 'Pausa',
  speed: 'Velocidad',
  restart: 'Reiniciar',
  end: 'Fin',
  showBB: 'Ver en BB',
  showChips: 'Ver en fichas',
  pot: 'Bote',
  comments: 'Comentarios',
  noComments: 'Aún no hay comentarios. Di qué te parece la jugada.',
  yourName: 'Tu nombre',
  nameOptional: 'Tu nombre (opcional)',
  anonymous: 'Anónimo',
  commentPlaceholder: '¿Cómo jugarías esta mano?',
  attachToStep: 'Vincular a este momento',
  wholeHand: 'La mano completa',
  youAreHere: 'Estás aquí',
  noStreetComments: 'Aún nada sobre esta calle. Comenta abajo.',
  send: 'Comentar',
  sending: 'Enviando…',
  commentTerms: 'Al comentar aceptas los',
  commentTermsLink: 'Términos',
  termsHref: '/terms',
  commentError: 'No se pudo enviar. Inténtalo de nuevo.',
  commentBlocked: 'No se pudo enviar el comentario.',
  rateLimited: 'Demasiados comentarios seguidos. Espera un minuto.',
  offensive: 'El comentario tiene lenguaje ofensivo. Reescríbelo, por favor.',
  report: 'Denunciar',
  reported: 'Denunciado. Gracias.',
  reportHand: 'Denunciar esta mano',
  voteToSeeComments: 'Primero vota qué harías. Después ves los comentarios y la jugada.',
  at: 'en',
  quizTitle: '¿Qué harías aquí?',
  quizFacing: 'Para pagar',
  quizThanks: 'Voto registrado. Mira lo que hizo el jugador.',
  quizSame: (a: string) => `El jugador también hizo ${a}. Piensan igual.`,
  quizDiff: (a: string) => `El jugador hizo ${a}. ¿Quién tiene razón?`,
  quizVotes: 'votos',
  quizVote: 'voto',
  quizContinue: 'Ver la jugada',
  quizSkip: 'Saltar y ver',
  quizAnswered: (n: number) => (n === 1 ? '1 persona ya respondió' : `${n} personas ya respondieron`),
  quizFirst: 'Sé el primero en responder',
  quizTop: (pct: number, a: string) => `${pct}% ${a}`,
  quizWithMost: 'Estás con la mayoría. ¿Y el jugador?',
  quizAgainstMost: 'Fuiste contra la mayoría. ¿Y el jugador?',
  ctaTitle: '¿Registras manos en vivo?',
  ctaBody: 'Guarda la mano en 10 segundos entre jugadas y compártela con tus amigos para recibir feedback.',
  ctaDownload: 'Descargar app',
  endTitle: 'Y tú, ¿cómo la jugarías?',
  endComment: 'Comentar',
  endApp: 'Quiero la app',
  ctaInvite: (pct: number) => `Vienes por invitación: instala, guarda tu primera mano y los dos reciben un ${pct}% en el primer mes de Pro.`,
  openInApp: 'Abrir en la app',
  comingSoon: 'Pronto en App Store y Google Play',
  notFound: 'Esta mano ya no existe.',
  invalid: 'Esta mano tiene datos no válidos y no se puede reproducir.',
  views: (n: number) => (n === 1 ? 'visualización' : 'visualizaciones'),
  copyLink: 'Copiar link',
  copied: 'Link copiado',
  copyManual: 'Copia el link:',
  revealError: 'No se pudo cargar el resto de la mano.',
  retry: 'Reintentar',
  shareNative: 'Compartir',
  notes: 'Notas del jugador',
  hero: 'Hero',
  log: 'Acción',
  winner: 'gana',
  justNow: 'ahora',
  minutesAgo: (n: number) => `hace ${n} min`,
  hoursAgo: (n: number) => `hace ${n} h`,
  daysAgo: (n: number) => `hace ${n} d`,
};

const dict: Record<Locale, Dict> = { pt, 'pt-BR': ptBR, en, es };

export const t = (locale: Locale): Dict => dict[locale];
