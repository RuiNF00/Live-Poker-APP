// Amounts as people type them. Kept apart from convert.ts so the receipt
// reader doesn't pull the whole CSV import into the shared chunk.

/** Cells that mean "nothing here" rather than an amount. */
export const NO_VALUE = /^(n\/?a|na|null|none|-+|—|–)$/i;

/**
 * "1.234,56", "1,234.56", "-€120", "(45)", "0,5" → numbers. Comma alone is a
 * decimal mark unless it groups thousands ("1,500").
 */
export function parseNum(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  let s = raw.trim().replace(/[−‒–]/g, '-');
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  // "1.5k" in a sheet typed by hand.
  const k = /\d\s*k$/i.test(s) ? 1000 : 1;
  s = s.replace(/[^\d.,\-+eE]/g, '');
  if (s.startsWith('-')) {
    neg = !neg;
    s = s.slice(1);
  } else if (s.startsWith('+')) s = s.slice(1);
  if (!/\d/.test(s)) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(/,/g, '.');
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return (neg ? -n : n) * k;
}
