/**
 * Text ⇄ number for amount fields. Whole fields (chips, places) keep only digits; money fields keep
 * up to two decimals. The decimal mark is the language's ("," in pt/es, "." in en), but a pasted
 * "1.234,56" or "1,234.56" reads right in any language: the last mark is the decimal one, the rest
 * are thousands.
 */
export function numText(value: number, money: boolean, comma: boolean): string {
  if (!value) return '';
  if (!money) return String(Math.round(value));
  const s = String(Math.round(value * 100) / 100);
  return comma ? s.replace('.', ',') : s;
}

export function parseNum(text: string, money: boolean, comma: boolean): number {
  if (!money) return parseInt(text.replace(/\D/g, ''), 10) || 0;
  let s = text.replace(/[^\d.,]/g, '');
  const dots = (s.match(/\./g) ?? []).length, commas = (s.match(/,/g) ?? []).length;
  let dec = '';
  if (dots && commas) dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
  else if (dots + commas === 1) {
    const mark = dots ? '.' : ',';
    // The other language's mark before exactly three digits is a thousands mark ("1.500" in pt).
    dec = mark === (comma ? ',' : '.') || !/^\d*[.,]\d{3}$/.test(s) ? mark : '';
  }
  const at = dec ? s.lastIndexOf(dec) : -1;
  const whole = (at < 0 ? s : s.slice(0, at)).replace(/\D/g, '');
  const cents = at < 0 ? '' : s.slice(at + 1).replace(/\D/g, '').slice(0, 2);
  s = `${whole || '0'}.${cents || '0'}`;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/** Keeps what the person is typing ("537," or "537,0") while the value it stands for is the same. */
export function syncText(text: string, value: number, money: boolean, comma: boolean): string {
  return parseNum(text, money, comma) === value ? text : numText(value, money, comma);
}
