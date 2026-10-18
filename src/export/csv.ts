// CSV cells for spreadsheets. Excel opens a file with the separator of its own
// language: a comma where decimals take a point, a semicolon where they take a
// comma (Portugal, Brazil, Spain). The import reads both back.

import { decimalComma } from '@/i18n';

export type CsvSep = ',' | ';';

/** The separator Excel expects in the player's language. */
export const csvSep = (): CsvSep => (decimalComma ? ';' : ',');

export function csvCell(v: string | number | undefined, sep: CsvSep = ','): string {
  if (v === undefined) return '';
  // Numbers stay numbers: with semicolons, decimals take a comma as in the spreadsheet's own language.
  if (typeof v === 'number') return sep === ';' ? String(v).replace('.', ',') : String(v);
  // Text starting like a formula (=, +, -, @) would run in the spreadsheet: a leading ' keeps it text.
  const s = /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
  return /[",;\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
