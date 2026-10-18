// Bytes of a picked file → text. Exports aren't all UTF-8: Excel on Windows
// saves "CSV" in Windows-1252 (São Paulo comes out as S�o Paulo), and its
// "Unicode text" is UTF-16 with tabs. Worked out from the bytes themselves.
// Pure, so it can be tested; no TextDecoder (not every phone engine has one).

const CP1252: Record<number, number> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d,
  0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178,
};

/** Code points → string in chunks: one call with a million arguments overflows the stack, and a 20 MB file never sits in memory as numbers. */
function writer() {
  const parts: string[] = [];
  const buf: number[] = [];
  return {
    push(cp: number) {
      buf.push(cp);
      if (buf.length === 8192) {
        parts.push(String.fromCodePoint(...buf));
        buf.length = 0;
      }
    },
    done() {
      if (buf.length) parts.push(String.fromCodePoint(...buf));
      return parts.join('');
    },
  };
}

/** Null when the bytes aren't valid UTF-8. */
function utf8(b: Uint8Array, start: number): string | null {
  const out = writer();
  let i = start;
  while (i < b.length) {
    const c = b[i];
    if (c < 0x80) {
      out.push(c);
      i++;
      continue;
    }
    const len = c >= 0xf0 && c < 0xf5 ? 4 : c >= 0xe0 ? 3 : c >= 0xc2 && c < 0xe0 ? 2 : 0;
    if (!len || i + len > b.length) return null;
    let cp = len === 2 ? c & 0x1f : len === 3 ? c & 0x0f : c & 0x07;
    for (let k = 1; k < len; k++) {
      const x = b[i + k];
      if ((x & 0xc0) !== 0x80) return null;
      cp = (cp << 6) | (x & 0x3f);
    }
    if ((len === 3 && (cp < 0x800 || (cp >= 0xd800 && cp <= 0xdfff))) || (len === 4 && (cp < 0x10000 || cp > 0x10ffff))) return null;
    out.push(cp);
    i += len;
  }
  return out.done();
}

function utf16(b: Uint8Array, start: number, little: boolean): string {
  // Emoji and other pairs of code units go through as they are and join up in the string.
  const parts: string[] = [];
  for (let i = start; i + 1 < b.length; i += 16384) {
    const units: number[] = [];
    for (let k = i; k + 1 < Math.min(b.length, i + 16384); k += 2) units.push(little ? b[k] | (b[k + 1] << 8) : (b[k] << 8) | b[k + 1]);
    parts.push(String.fromCharCode(...units));
  }
  return parts.join('');
}

function cp1252(b: Uint8Array): string {
  const out = writer();
  for (let i = 0; i < b.length; i++) out.push(CP1252[b[i]] ?? b[i]);
  return out.done();
}

/** How the file's bytes were written, and the text. */
export function decodeText(b: Uint8Array): { text: string; encoding: 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252' } {
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return { text: utf8(b, 3) ?? cp1252(b.subarray(3)), encoding: 'utf-8' };
  if (b[0] === 0xff && b[1] === 0xfe) return { text: utf16(b, 2, true), encoding: 'utf-16le' };
  if (b[0] === 0xfe && b[1] === 0xff) return { text: utf16(b, 2, false), encoding: 'utf-16be' };
  // UTF-16 without a mark: text in Latin letters has a zero in every other byte.
  const n = Math.min(b.length, 4096) & ~1;
  let evenZero = 0;
  let oddZero = 0;
  for (let i = 0; i < n; i += 2) {
    if (b[i] === 0) evenZero++;
    if (b[i + 1] === 0) oddZero++;
  }
  if (n >= 8 && oddZero > n / 4 && evenZero < n / 40) return { text: utf16(b, 0, true), encoding: 'utf-16le' };
  if (n >= 8 && evenZero > n / 4 && oddZero < n / 40) return { text: utf16(b, 0, false), encoding: 'utf-16be' };
  const text = utf8(b, 0);
  return text !== null ? { text, encoding: 'utf-8' } : { text: cp1252(b), encoding: 'windows-1252' };
}
