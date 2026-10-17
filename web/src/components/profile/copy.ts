import type { Locale } from '@/lib/i18n';

// Text for public profiles (/u/<handle>), in the site's two languages.
const pt = {
  follow: (h: string) => `Seguir @${h}`,
  followNote: 'Segue na app do Sweatbook. É grátis.',
  sessions: 'Sessões',
  hands: 'Mãos',
  hours: 'h à mesa',
  nSessions: (n: number) => (n === 1 ? '1 sessão' : `${n} sessões`),
  nHands: (n: number) => (n === 1 ? '1 mão' : `${n} mãos`),
  tournament: 'Torneio',
  cash: 'Cash',
  place: (n: number, field?: number) => (field ? `${n}º de ${field}` : `${n}º lugar`),
  result: 'Resultado',
  buyIn: 'Buy-in',
  played: 'Jogadas',
  handsLogged: (n: number) => (n === 1 ? '1 mão registada' : `${n} mãos registadas`),
  challenge: 'Desafio',
  open: 'Ver mão',
  empty: 'Ainda não há nada partilhado neste perfil.',
  amountsHidden: 'Montantes escondidos pelo jogador',
  report: 'Denunciar perfil',
  reported: 'Obrigado. Vamos rever este perfil.',
  ctaTitle: 'Também jogas live?',
  ctaBody: 'Regista as tuas mãos e sessões em segundos, revê-as no replayer e cria o teu perfil.',
  notFound: 'Perfil não encontrado',
  metaDescription: (name: string) => `Mãos e sessões de póquer live de ${name} no Sweatbook.`,
};

const en: typeof pt = {
  follow: (h: string) => `Follow @${h}`,
  followNote: 'Follow in the Sweatbook app. It is free.',
  sessions: 'Sessions',
  hands: 'Hands',
  hours: 'h at the table',
  nSessions: (n: number) => (n === 1 ? '1 session' : `${n} sessions`),
  nHands: (n: number) => (n === 1 ? '1 hand' : `${n} hands`),
  tournament: 'Tournament',
  cash: 'Cash',
  place: (n: number, field?: number) => (field ? `#${n} of ${field}` : `#${n}`),
  result: 'Result',
  buyIn: 'Buy-in',
  played: 'Played',
  handsLogged: (n: number) => (n === 1 ? '1 hand logged' : `${n} hands logged`),
  challenge: 'Challenge',
  open: 'See hand',
  empty: 'Nothing shared on this profile yet.',
  amountsHidden: 'Amounts hidden by the player',
  report: 'Report profile',
  reported: 'Thanks. We will review this profile.',
  ctaTitle: 'Playing live too?',
  ctaBody: 'Log your hands and sessions in seconds, review them in the replayer and make your own profile.',
  notFound: 'Profile not found',
  metaDescription: (name: string) => `${name}'s live poker hands and sessions on Sweatbook.`,
};

export const profileCopy = (l: Locale) => (l === 'en' ? en : pt);
export type ProfileCopy = typeof pt;
