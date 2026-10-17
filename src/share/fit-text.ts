// Font size that keeps a one-line number inside its box, worked out from its length.
// Share cards are captured as images: React Native's adjustsFontSizeToFit stops at
// minimumFontScale and then cuts the text ("+1 229 2…"), and the web ignores it.
// Amounts from 1000 up carry cents ("+12 345,67 €"), so the longest ones need this.

/** Width of one character, in em: JetBrains Mono is 0.6; the bold sans digits are a little narrower. */
export const MONO_EM = 0.6;
export const SANS_EM = 0.6;

export function fitFont(text: string, base: number, width: number, opts: { em?: number; letterSpacing?: number; min?: number } = {}): number {
  const n = [...text].length;
  if (!n || width <= 0) return base;
  const em = opts.em ?? MONO_EM;
  const ls = opts.letterSpacing ?? 0;
  // The letter spacing shrinks with the font (FitText scales it), so per character: size × (em + ls/base).
  // 2% to spare for rounding and the odd wider glyph.
  const size = (width * 0.98) / (n * (em + ls / base));
  const min = opts.min ?? Math.round(base * 0.3);
  return Math.max(min, Math.min(base, Math.floor(size * 2) / 2));
}
