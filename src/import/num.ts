// Amounts as people type them. Kept apart from convert.ts so the receipt
// reader doesn't pull the whole CSV import into the shared chunk.

/** Cells that mean "nothing here" rather than an amount. */
export const NO_VALUE = /^(n\/?a|na|null|none|-+|—|–)$/i;

/**
 * "1.234,56", "1,234.56", "-€120", "(45)", "0,5" → numbers. Comma alone is a
 * decimal mark unless it groups thousands ("1,500").
 */
/** How the file writes decimals, when it says so: "12,50" (comma) or "12.50" (point). */
export type DecimalMark = 'comma' | 'point';

/** With `mark`, the file's own decimal mark decides; without it, each cell is read on its own. */
export function parseNum(raw: string | undefined, mark?: DecimalMark): number | null {
  if (raw === undefined) return null;
  let s = raw.trim();
  if (!s) return null;
  // Most cells are plain numbers: skip the clean-up below (it adds up over thousands of rows).
  if (mark !== 'comma' && /^-?\d+(\.\d+)?$/.test(s)) return sane(Number(s));
  s = s.replace(/[−‒–]/g, '-');
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
  if (mark === 'comma') s = s.replace(/\./g, '').replace(/,(?=[^,]*$)/, '.').replace(/,/g, '');
  else if (mark === 'point') s = s.replace(/,/g, '');
  else if (lastDot >= 0 && lastComma >= 0) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(/,/g, '.');
  } else if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(s)) {
    // "R$ 1.235", "10.000 €", "1.000.000": dots between groups of three are thousands
    // (a bare "1.250" took the fast path above and stays 1.25).
    s = s.replace(/\./g, '');
  }
  return sane((neg ? -Number(s) : Number(s)) * k);
}

/** No buy-in or prize reaches a trillion: a longer run of digits is a broken cell, and Infinity would be saved as null. */
const sane = (n: number) => (Number.isFinite(n) && Math.abs(n) < 1e12 ? n : null);
