import type { Locale } from '@/lib/i18n';

// Text for a festival action agreement (/o/<id>), in the same two languages as the rest of
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
  rateLimited: 'Too many tries in a row. Try again later.',
  footer: 'A record of the deal between you and your backers. No money goes through Sweatbook.',
  ctaTitle: 'Follow every player you back',
  ctaBody: 'In Sweatbook you see your pieces, what you are owed, makeup and live sessions for every player, in one place.',
  notFound: 'This deal is no longer here.',
  metaTitle: (player: string) => (player ? `${player} recorded your piece` : 'Your piece, recorded'),
  metaDescription: 'Confirm the piece you agreed with the player.',
};

export type OfferCopy = typeof pt;
export const offerCopy = (locale: Locale): OfferCopy => (locale === 'pt' ? pt : en);

/** Numbers the Portuguese way (2.750 and 1,15) or the English way (2,750 and 1.15). */
export function offerFormat(locale: Locale) {
  const tag = locale === 'pt' ? 'de-DE' : 'en-GB';
  const n2 = new Intl.NumberFormat(tag, { maximumFractionDigits: 2 });
  const fixed2 = new Intl.NumberFormat(tag, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return {
    /** Whole amounts without cents; anything else always with two decimals. */
    money: (n: number, cur: string) => {
      const a = Number.isInteger(n) ? n2.format(n) : fixed2.format(n);
      return locale === 'pt' ? `${a}${cur}` : `${cur}${a}`;
    },
    pct: (n: number) => `${n2.format(n)}%`,
    markup: (n: number) => fixed2.format(n),
  };
}
