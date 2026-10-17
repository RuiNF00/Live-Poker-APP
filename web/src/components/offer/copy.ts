import type { Locale } from '@/lib/i18n';

// Text for a festival action package (/o/<id>), in the same two languages as the rest of the site.
const pt = {
  eyebrow: 'Venda de ação',
  heading: (player: string) => (player ? `${player} vende ação` : 'Ação à venda'),
  events: (n: number) => (n === 1 ? '1 torneio' : `${n} torneios`),
  totalBuyIns: 'Buy-ins no total',
  markup: (m: string) => `markup ${m}`,
  onSale: (pct: string) => `${pct} à venda`,
  perPercent: 'Preço de 1% do pacote',
  perPercentHint: '1% de cada torneio, com markup',
  schedule: 'Torneios',
  free: (x: string, y: string) => `${x} de ${y} ainda livre`,
  soldOutEvent: 'Esgotado',
  formTitle: 'Reserva a tua parte',
  name: 'O teu nome',
  namePh: 'Como o jogador te conhece',
  contact: 'Contacto (opcional)',
  contactPh: 'Telemóvel ou @utilizador',
  wholeTitle: 'Pacote inteiro',
  wholeHint: 'A mesma % em todos os torneios.',
  perEventHint: 'Escolhe a % de cada torneio. Deixa a 0 os que não queres.',
  limits: (min: string, cap: string) => `Mínimo ${min}, máximo ${cap} por torneio.`,
  upTo: (x: string) => `até ${x}`,
  less: 'Menos',
  more: 'Mais',
  youPay: (price: string) => `Pagas ${price}`,
  pickSome: 'Escolhe pelo menos um torneio',
  reserve: 'Reservar',
  sending: 'A enviar…',
  sent: (player: string) => (player ? `Reserva enviada. ${player} confirma contigo.` : 'Reserva enviada. O jogador confirma contigo.'),
  sentBody: 'Nada é pago aqui: combinas o pagamento diretamente com o jogador quando ele confirmar.',
  another: 'Fazer outra reserva',
  closedTitle: 'Reservas fechadas',
  closedBody: (player: string) => `${player || 'O jogador'} já não aceita novas reservas para este pacote.`,
  soldOutTitle: 'Esgotado',
  soldOutBody: 'Toda a ação deste pacote já está reservada.',
  privacy: 'Só o jogador vê o teu nome e contacto. Ninguém mais vê quem reservou.',
  errors: {
    sold_out: 'Alguém reservou primeiro. Já atualizámos o que está livre.',
    closed: 'O jogador fechou as reservas entretanto.',
    over_cap: 'Passa do máximo que cada backer pode ter.',
    full: 'Este pacote já não aceita mais reservas.',
    offensive: 'O nome ou contacto tem linguagem ofensiva.',
    rate_limited: 'Demasiadas reservas seguidas. Tenta mais tarde.',
    invalid: 'Confirma o nome e as percentagens.',
    generic: 'Não foi possível reservar. Tenta outra vez.',
  },
  ctaTitle: 'Bancas jogadores?',
  ctaBody: 'Na Sweatbook segues as sessões em direto, o que te devem e o makeup de cada jogador que bancas.',
  notFound: 'Este pacote já não está disponível.',
  metaTitle: (player: string, title: string) => [player ? `${player} vende ação` : 'Ação à venda', title].filter(Boolean).join(' · '),
  metaDescription: (events: string, markup: string) => `${events} · ${markup} · reserva a tua parte`,
};

const en: typeof pt = {
  eyebrow: 'Action for sale',
  heading: (player: string) => (player ? `${player} is selling action` : 'Action for sale'),
  events: (n: number) => (n === 1 ? '1 event' : `${n} events`),
  totalBuyIns: 'Total buy-ins',
  markup: (m: string) => `markup ${m}`,
  onSale: (pct: string) => `${pct} for sale`,
  perPercent: 'Price of 1% of the package',
  perPercentHint: '1% of every event, markup included',
  schedule: 'Events',
  free: (x: string, y: string) => `${x} of ${y} still free`,
  soldOutEvent: 'Sold out',
  formTitle: 'Reserve your piece',
  name: 'Your name',
  namePh: 'How the player knows you',
  contact: 'Contact (optional)',
  contactPh: 'Phone or @handle',
  wholeTitle: 'Whole package',
  wholeHint: 'The same % of every event.',
  perEventHint: "Pick a % of each event. Leave the ones you don't want at 0.",
  limits: (min: string, cap: string) => `Minimum ${min}, maximum ${cap} per event.`,
  upTo: (x: string) => `up to ${x}`,
  less: 'Less',
  more: 'More',
  youPay: (price: string) => `You pay ${price}`,
  pickSome: 'Pick at least one event',
  reserve: 'Reserve',
  sending: 'Sending…',
  sent: (player: string) => (player ? `Reservation sent. ${player} will confirm with you.` : 'Reservation sent. The player will confirm with you.'),
  sentBody: 'Nothing is paid here: you settle payment directly with the player once they confirm.',
  another: 'Make another reservation',
  closedTitle: 'Reservations closed',
  closedBody: (player: string) => `${player || 'The player'} is no longer taking reservations for this package.`,
  soldOutTitle: 'Sold out',
  soldOutBody: 'All the action in this package is already reserved.',
  privacy: 'Only the player sees your name and contact. Nobody else sees who reserved.',
  errors: {
    sold_out: 'Someone reserved first. What is free is now up to date.',
    closed: 'The player has just closed reservations.',
    over_cap: 'That is more than one backer may take.',
    full: 'This package is not taking more reservations.',
    offensive: 'The name or contact contains offensive language.',
    rate_limited: 'Too many reservations in a row. Try again later.',
    invalid: 'Check your name and the percentages.',
    generic: 'Could not reserve. Try again.',
  },
  ctaTitle: 'Backing players?',
  ctaBody: 'With Sweatbook you follow live sessions, what you are owed and the makeup for every player you back.',
  notFound: 'This package is no longer available.',
  metaTitle: (player: string, title: string) => [player ? `${player} is selling action` : 'Action for sale', title].filter(Boolean).join(' · '),
  metaDescription: (events: string, markup: string) => `${events} · ${markup} · reserve your piece`,
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
