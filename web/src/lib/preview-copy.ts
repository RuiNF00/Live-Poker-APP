import type { Locale } from '@/lib/i18n';

// Text of a shared hand's link preview (title, description and image), in the sharer's language.
const pt = {
  notFound: 'Esta mão já não existe',
  goneBody: 'O link pode ter sido apagado por quem o partilhou.',
  challengeTitle: (title: string) => `Desafio: o que fazes aqui? · ${title}`,
  challengeDescription: 'Vota no que fazias antes de veres a jogada.',
  description: 'Vê a mão e diz como jogavas.',
  challenge: 'Desafio',
  challengeHeadline: 'O que fazes aqui?',
  headline: 'Como jogavas esta mão?',
  subline: 'Vê o replay e diz como jogavas',
  spotStack: (pos: string, bb: string) => `${pos} com ${bb}`,
  facing: (chips: string) => `a pagar ${chips}`,
  first: 'a decidir primeiro',
  pot: (chips: string) => `pote ${chips}`,
  packHands: (n: number) => (n === 1 ? '1 mão' : `${n} mãos`),
  packHeadline: 'O que fazias em cada uma?',
  swap: 'Swap',
  swapHeadline: 'Swap entre jogadores',
  swapSubline: 'Confirma e acompanha quem deve a quem',
};

const ptBR: typeof pt = {
  notFound: 'Esta mão não existe mais',
  goneBody: 'Quem compartilhou pode ter apagado o link.',
  challengeTitle: (title) => `Desafio: o que você faz aqui? · ${title}`,
  challengeDescription: 'Vote no que você faria antes de ver a jogada.',
  description: 'Veja a mão e diga como você jogaria.',
  challenge: 'Desafio',
  challengeHeadline: 'O que você faz aqui?',
  headline: 'Como você jogaria esta mão?',
  subline: 'Veja o replay e diga como você jogaria',
  spotStack: (pos, bb) => `${pos} com ${bb}`,
  facing: (chips) => `para pagar ${chips}`,
  first: 'primeiro a agir',
  pot: (chips) => `pote ${chips}`,
  packHands: (n) => (n === 1 ? '1 mão' : `${n} mãos`),
  packHeadline: 'O que você faria em cada uma?',
  swap: 'Swap',
  swapHeadline: 'Swap entre jogadores',
  swapSubline: 'Confirme e acompanhe quem deve a quem',
};

const es: typeof pt = {
  notFound: 'Esta mano ya no existe',
  goneBody: 'Quien la compartió puede haber borrado el link.',
  challengeTitle: (title) => `Reto: ¿qué haces aquí? · ${title}`,
  challengeDescription: 'Vota qué harías antes de ver la jugada.',
  description: 'Mira la mano y di cómo la jugarías.',
  challenge: 'Reto',
  challengeHeadline: '¿Qué haces aquí?',
  headline: '¿Cómo jugarías esta mano?',
  subline: 'Mira el replay y di cómo la jugarías',
  spotStack: (pos, bb) => `${pos} con ${bb}`,
  facing: (chips) => `para pagar ${chips}`,
  first: 'primero en hablar',
  pot: (chips) => `bote ${chips}`,
  packHands: (n) => (n === 1 ? '1 mano' : `${n} manos`),
  packHeadline: '¿Qué harías en cada una?',
  swap: 'Swap',
  swapHeadline: 'Swap entre jugadores',
  swapSubline: 'Confírmalo y sigue quién le debe a quién',
};

const en: typeof pt = {
  notFound: 'This hand no longer exists',
  goneBody: 'Whoever shared it may have deleted the link.',
  challengeTitle: (title) => `Challenge: what do you do here? · ${title}`,
  challengeDescription: 'Vote on your play before you see what happened.',
  description: "Watch the hand and say how you'd play it.",
  challenge: 'Challenge',
  challengeHeadline: 'What do you do here?',
  headline: 'How would you play this hand?',
  subline: "Watch the replay and say how you'd play it",
  spotStack: (pos, bb) => `${pos} with ${bb}`,
  facing: (chips) => `facing ${chips}`,
  first: 'first to act',
  pot: (chips) => `pot ${chips}`,
  packHands: (n) => (n === 1 ? '1 hand' : `${n} hands`),
  packHeadline: 'What would you do in each?',
  swap: 'Swap',
  swapHeadline: 'Swap between players',
  swapSubline: 'Confirm it and follow who owes whom',
};

const COPY: Record<Locale, typeof pt> = { pt, 'pt-BR': ptBR, es, en };

export const previewCopy = (l: Locale) => COPY[l];
