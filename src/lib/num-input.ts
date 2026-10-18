/**
 * Text ⇄ number for amount fields. Whole fields (chips, places) are whole; money fields keep up to
 * two decimals. The decimal mark is the language's ("," in pt/es, "." in en), but a pasted
 * "1.234,56" or "1,234.56" reads right in any language: the last mark is the decimal one, the rest
 * are thousands.
 */
export function numText(value: number, money: boolean, comma: boolean): string {
  if (!value) return '';
  if (!money) return String(Math.round(value));
  const s = String(Math.round(value * 100) / 100);
  return comma ? s.replace('.', ',') : s;
}

/** Where the decimal mark is in `s` (digits and marks only), or -1 when every mark is a thousands one. */
function decimalAt(s: string, comma: boolean): number {
  const dots = (s.match(/\./g) ?? []).length, commas = (s.match(/,/g) ?? []).length;
  if (dots && commas) return Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  if (dots + commas !== 1) return -1;
  const mark = dots ? '.' : ',';
  // The other language's mark before exactly three digits is a thousands mark ("1.500" in pt).
  return mark === (comma ? ',' : '.') || !/^\d*[.,]\d{3}$/.test(s) ? s.indexOf(mark) : -1;
}

export function parseNum(text: string, money: boolean, comma: boolean): number {
  const s = text.replace(/[^\d.,]/g, '');
  const at = decimalAt(s, comma);
  const whole = (at < 0 ? s : s.slice(0, at)).replace(/\D/g, '');
  // A whole field stops at the decimal mark: a pasted "12,5" is 12, not 125.
  if (!money) return parseInt(whole, 10) || 0;
  const cents = at < 0 ? '' : s.slice(at + 1).replace(/\D/g, '').slice(0, 2);
  const n = Number(`${whole || '0'}.${cents || '0'}`);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/** What a money field shows while typing: never more than two digits after the decimal mark. */
export function typedText(text: string, money: boolean, comma: boolean): string {
  // Pastes with symbols or spaces ("€ 2 500,00") are left as they are; parseNum keeps two decimals.
  if (!money || !/^[\d.,]*$/.test(text)) return text;
  const at = decimalAt(text, comma);
  return at < 0 ? text : text.slice(0, at + 3);
}

/** Keeps what the person is typing ("537," or "537,0") while the value it stands for is the same. */
export function syncText(text: string, value: number, money: boolean, comma: boolean): string {
  return parseNum(text, money, comma) === value ? text : numText(value, money, comma);
}
