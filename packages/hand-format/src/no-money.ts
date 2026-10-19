// Shared pictures and previews never carry money: a tournament or game name typed with its buy-in
// («Main Event €550», «Event #12 $1500», «Torneio 100 euros») keeps its words. Used by the app's
// hand poster title and the site's link previews (og:description and the preview image), so both
// drop the same amounts.

import { CURRENCY_INFO } from './money';

// Every currency the app stores, as its ISO code, plus the words people type, in any case.
const CODES = [...new Set(Object.values(CURRENCY_INFO).map((c) => c.code))].join('|');
const WORDS = 'euros?|d[oó]lar(?:es)?|dollars?|reais|pesos?|kr';
// Symbols: any «$» with up to four letters before it (US$, CA$, CLP$) or «$U», €, £, ¥, ₱, ₩, ₹, ₫, S/, zł, Kč.
const CUR = `(?:[A-Za-z]{0,4}\\$[Uu]?|[€£¥₱₩₹₫]|S\\/|z[łl]|K[čc]|(?:${CODES}|${WORDS})(?![A-Za-z]))`;
const NUM = '\\d[\\d.,]*(?:\\s*[kKmM](?![A-Za-z]))?';
// A currency before the number («€550», «US$ 300»), or after it when no number follows
// («550 €»; in «#12 $1500» the $ belongs to 1500).
const AMT = `(?:${CUR}\\s*${NUM}|${NUM}\\s*${CUR}(?!\\s*\\d)|${NUM})`;
const AMOUNTS = new RegExp(`(?<![A-Za-z])${AMT}(?:\\s*\\/\\s*${AMT})*`, 'gi');
const HAS_CUR = new RegExp(CUR, 'i');

/** The text without amounts of money; numbers without a currency («Day 1A», «6-Max 2025», «1/2») stay. */
export function withoutMoney(text: string | null | undefined): string {
  return (text ?? '')
    .replace(AMOUNTS, (m) => (HAS_CUR.test(m.replace(/\d/g, '')) ? ' ' : m))
    .replace(/\s+\+\s+(?=\s|$)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s·|,–+-]+|[\s·|,–+-]+$/g, '')
    .trim();
}
