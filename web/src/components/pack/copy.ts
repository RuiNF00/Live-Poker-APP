import type { Locale } from '@/lib/i18n';

const pt = {
  kicker: (n: number) => (n === 1 ? '1 mão partilhada' : `${n} mãos partilhadas`),
  of: (i: number, n: number) => `Mão ${i} de ${n}`,
  prev: 'Mão anterior',
  next: 'Mão seguinte',
  gone: 'Estas mãos já não estão partilhadas.',
  metaTitle: (title: string, n: number) => (title ? `${title} · ${n} mãos` : `${n} mãos para rever`),
  metaDescription: 'Vê cada mão no replay e diz como jogavas.',
};

const en: typeof pt = {
  kicker: (n) => (n === 1 ? '1 shared hand' : `${n} shared hands`),
  of: (i, n) => `Hand ${i} of ${n}`,
  prev: 'Previous hand',
  next: 'Next hand',
  gone: 'These hands are no longer shared.',
  metaTitle: (title, n) => (title ? `${title} · ${n} hands` : `${n} hands to review`),
  metaDescription: 'Replay each hand and say how you would play it.',
};

const ptBR: typeof pt = {
  kicker: (n) => (n === 1 ? '1 mão compartilhada' : `${n} mãos compartilhadas`),
  of: (i, n) => `Mão ${i} de ${n}`,
  prev: 'Mão anterior',
  next: 'Próxima mão',
  gone: 'Estas mãos não estão mais compartilhadas.',
  metaTitle: (title, n) => (title ? `${title} · ${n} mãos` : `${n} mãos para revisar`),
  metaDescription: 'Veja cada mão no replay e diga como você jogaria.',
};

const es: typeof pt = {
  kicker: (n) => (n === 1 ? '1 mano compartida' : `${n} manos compartidas`),
  of: (i, n) => `Mano ${i} de ${n}`,
  prev: 'Mano anterior',
  next: 'Mano siguiente',
  gone: 'Estas manos ya no están compartidas.',
  metaTitle: (title, n) => (title ? `${title} · ${n} manos` : `${n} manos para revisar`),
  metaDescription: 'Mira cada mano en el replay y di cómo la jugarías.',
};

const COPY: Record<Locale, typeof pt> = { pt, 'pt-BR': ptBR, es, en };

export type PackCopy = typeof pt;
export const packCopy = (l: Locale): PackCopy => COPY[l];
