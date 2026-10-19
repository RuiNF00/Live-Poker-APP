// Link previews (og:description and the preview image) never carry money: a tournament or game
// name typed with its buy-in («Main Event €550») keeps its words. Same rule as the app's poster
// title (src/share/hand-poster.ts posterTitle).

const CUR = '(?:[€$£]|R\\$|EUR|USD|GBP|BRL)';
const AMT = `(?:${CUR}\\s*)?\\d[\\d.,]*\\s*[kK]?(?:\\s*${CUR}(?![A-Za-z]))?`;
// One amount or a stakes pair («€1/€2», «2/5 €»); it only counts as money with a currency in it.
const AMOUNTS = new RegExp(`${AMT}(?:\\s*\\/\\s*${AMT})*`, 'g');
const HAS_CUR = new RegExp(CUR);

export function withoutMoney(text: string | null | undefined): string {
  return (text ?? '')
    .replace(AMOUNTS, (m) => (HAS_CUR.test(m) ? ' ' : m))
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s·|,–-]+|[\s·|,–-]+$/g, '')
    .trim();
}
