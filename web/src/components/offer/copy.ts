import { numberTag, formatMoney, type Locale } from '../../lib/i18n';

// Text for a festival action agreement (/o/<id>), in the same languages as the rest of
// the site. Store policy (research/politicas-lojas-jogo.md §3): this is a record of a deal
// already made, so no word here sells, invites to pay or advertises what is left.
const pt = {
  eyebrow: 'Acordo de staking',
  heading: (player: string) => (player ? `${player} registou a tua parte` : 'A tua parte registada'),
  sub: (title: string, backer: string) => [title, backer ? `para ${backer}` : ''].filter(Boolean).join(' · '),
  events: (n: number) => (n === 1 ? '1 torneio' : `${n} torneios`),
  schedule: 'Torneios',
  buyIn: 'Buy-in',
  yourPct: 'A tua %',
  cost: 'Custo',
  total: (markup: string) => `Custo da tua parte (markup ${markup})`,
  totalHint: 'A tua % de cada buy-in, com o markup acordado.',
  confirm: 'Confirmar a parte acordada',
  confirming: 'A confirmar…',
  confirmHint: 'Confirma que estes são os termos que combinaste com o jogador.',
  confirmed: (date: string) => `Confirmaste a ${date}`,
  confirmedHint: 'O jogador vê a tua confirmação na app. Se ele mudar os termos, pedimos-te que confirmes outra vez.',
  error: 'Não foi possível confirmar. Tenta outra vez.',
  changed: 'O jogador mudou os termos depois de abrires esta página. Revê os termos novos antes de confirmar.',
  review: 'Ver os termos novos',
  rateLimited: 'Demasiadas tentativas seguidas. Tenta mais tarde.',
  footer: 'Registo do acordo entre ti e os teus backers. Nenhum dinheiro passa pela Sweatbook.',
  ctaTitle: 'Segue todos os jogadores que bancas',
  ctaBody: 'Na Sweatbook vês as tuas partes, o que te devem, o makeup e as sessões em direto de cada jogador, num só sítio.',
  notFound: 'Este acordo já não existe.',
  metaTitle: (player: string) => (player ? `${player} registou a tua parte` : 'A tua parte registada'),
  metaDescription: 'Confirma a parte acordada com o jogador.',
};

const en: typeof pt = {
  eyebrow: 'Staking deal',
  heading: (player: string) => (player ? `${player} recorded your piece` : 'Your piece, recorded'),
  sub: (title: string, backer: string) => [title, backer ? `for ${backer}` : ''].filter(Boolean).join(' · '),
  events: (n: number) => (n === 1 ? '1 event' : `${n} events`),
  schedule: 'Events',
  buyIn: 'Buy-in',
  yourPct: 'Your %',
  cost: 'Cost',
  total: (markup: string) => `Cost of your piece (markup ${markup})`,
  totalHint: 'Your % of each buy-in, with the agreed markup.',
  confirm: 'Confirm the agreed piece',
  confirming: 'Confirming…',
  confirmHint: 'Confirm these are the terms you agreed with the player.',
  confirmed: (date: string) => `You confirmed on ${date}`,
  confirmedHint: 'The player sees your confirmation in the app. If they change the terms, we ask you to confirm again.',
  error: 'Could not confirm. Try again.',
  changed: 'The player changed the terms after you opened this page. Check the new terms before confirming.',
  review: 'See the new terms',
  rateLimited: 'Too many tries in a row. Try again later.',
  footer: 'A record of the deal between you and your backers. No money goes through Sweatbook.',
  ctaTitle: 'Follow every player you back',
  ctaBody: 'In Sweatbook you see your pieces, what you are owed, makeup and live sessions for every player, in one place.',
  notFound: 'This deal is no longer here.',
  metaTitle: (player: string) => (player ? `${player} recorded your piece` : 'Your piece, recorded'),
  metaDescription: 'Confirm the piece you agreed with the player.',
};

const ptBR: typeof pt = {
  eyebrow: 'Acordo de staking',
  heading: (player: string) => (player ? `${player} registrou a sua parte` : 'Sua parte registrada'),
  sub: (title: string, backer: string) => [title, backer ? `para ${backer}` : ''].filter(Boolean).join(' · '),
  events: (n: number) => (n === 1 ? '1 torneio' : `${n} torneios`),
  schedule: 'Torneios',
  buyIn: 'Buy-in',
  yourPct: 'Sua %',
  cost: 'Custo',
  total: (markup: string) => `Custo da sua parte (markup ${markup})`,
  totalHint: 'Sua % de cada buy-in, com o markup acordado.',
  confirm: 'Confirmar a sua parte',
  confirming: 'Confirmando…',
  confirmHint: 'Confirme que estes são os termos que você combinou com o jogador.',
  confirmed: (date: string) => `Você confirmou em ${date}`,
  confirmedHint: 'O jogador vê sua confirmação no app. Se ele mudar os termos, pediremos que você confirme de novo.',
  error: 'Não foi possível confirmar. Tente de novo.',
  changed: 'O jogador mudou os termos depois que você abriu esta página. Revise os termos novos antes de confirmar.',
  review: 'Ver os termos novos',
  rateLimited: 'Muitas tentativas seguidas. Tente mais tarde.',
  footer: 'Registro do acordo entre você e seus backers. Nenhum dinheiro passa pela Sweatbook.',
  ctaTitle: 'Acompanhe todos os jogadores que você banca',
  ctaBody: 'Na Sweatbook você vê suas partes, o que devem a você, o makeup e as sessões ao vivo de cada jogador, num só lugar.',
  notFound: 'Este acordo não existe mais.',
  metaTitle: (player: string) => (player ? `${player} registrou a sua parte` : 'Sua parte registrada'),
  metaDescription: 'Confirme a sua parte acordada com o jogador.',
};

const es: typeof pt = {
  eyebrow: 'Acuerdo de staking',
  heading: (player: string) => (player ? `${player} registró tu parte` : 'Tu parte, registrada'),
  sub: (title: string, backer: string) => [title, backer ? `para ${backer}` : ''].filter(Boolean).join(' · '),
  events: (n: number) => (n === 1 ? '1 torneo' : `${n} torneos`),
  schedule: 'Torneos',
  buyIn: 'Buy-in',
  yourPct: 'Tu %',
  cost: 'Costo',
  total: (markup: string) => `Costo de tu parte (markup ${markup})`,
  totalHint: 'Tu % de cada buy-in, con el markup acordado.',
  confirm: 'Confirma tu parte',
  confirming: 'Confirmando…',
  confirmHint: 'Confirma que estos son los términos que acordaste con el jugador.',
  confirmed: (date: string) => `Confirmaste el ${date}`,
  confirmedHint: 'El jugador ve tu confirmación en la app. Si cambia los términos, te pediremos que confirmes de nuevo.',
  error: 'No se pudo confirmar. Inténtalo de nuevo.',
  changed: 'El jugador cambió los términos después de que abrieras esta página. Revisa los términos nuevos antes de confirmar.',
  review: 'Ver los términos nuevos',
  rateLimited: 'Demasiados intentos seguidos. Inténtalo más tarde.',
  footer: 'Registro del acuerdo entre tú y tus backers. Ningún dinero pasa por Sweatbook.',
  ctaTitle: 'Sigue a todos los jugadores que bancas',
  ctaBody: 'En Sweatbook ves tus partes, lo que te deben, el makeup y las sesiones en vivo de cada jugador, en un solo lugar.',
  notFound: 'Este acuerdo ya no existe.',
  metaTitle: (player: string) => (player ? `${player} registró tu parte` : 'Tu parte, registrada'),
  metaDescription: 'Confirma tu parte acordada con el jugador.',
};

export type OfferCopy = typeof pt;
const copy: Record<Locale, OfferCopy> = { pt, 'pt-BR': ptBR, en, es };
export const offerCopy = (locale: Locale): OfferCopy => copy[locale];

/** Numbers the Portuguese/Spanish way (2.750 and 1,15) or the English way (2,750 and 1.15). */
export function offerFormat(locale: Locale) {
  const tag = numberTag(locale);
  const n2 = new Intl.NumberFormat(tag, { maximumFractionDigits: 2 });
  const fixed2 = new Intl.NumberFormat(tag, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return {
    /** Whole amounts without cents; anything else always with two decimals. */
    money: (n: number, cur: string) => formatMoney(n, cur, locale),
    pct: (n: number) => `${n2.format(n)}%`,
    markup: (n: number) => fixed2.format(n),
  };
}
