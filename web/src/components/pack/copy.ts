import type { Locale } from '@/lib/i18n';

const pt = {
  kicker: 'Mãos partilhadas',
  hands: (n: number) => (n === 1 ? '1 mão' : `${n} mãos`),
  of: (i: number, n: number) => `Mão ${i} de ${n}`,
  prev: 'Mão anterior',
  next: 'Mão seguinte',
  gone: 'Estas mãos já não estão partilhadas.',
  metaTitle: (title: string, n: number) => (title ? `${title} · ${n} mãos` : `${n} mãos para rever`),
  metaDescription: 'Vê cada mão no replay e diz como jogavas.',
};

const en: typeof pt = {
  kicker: 'Shared hands',
  hands: (n) => (n === 1 ? '1 hand' : `${n} hands`),
  of: (i, n) => `Hand ${i} of ${n}`,
  prev: 'Previous hand',
  next: 'Next hand',
  gone: 'These hands are no longer shared.',
  metaTitle: (title, n) => (title ? `${title} · ${n} hands` : `${n} hands to review`),
  metaDescription: 'Replay each hand and say how you would play it.',
};

export type PackCopy = typeof pt;
export const packCopy = (l: Locale): PackCopy => (l === 'en' ? en : pt);
