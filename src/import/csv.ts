// CSV reading for imports from other apps. Exports differ in separator (comma,
// semicolon in Europe, tab), quoting and the junk above the header (Poker
// Bankroll Tracker writes "---PBT Bankroll Export---" first), so all of that
// is worked out from the text itself. Pure, so it can be tested.

export interface Table {
  headers: string[];
  rows: string[][];
  /** Line in the file of each row (1 = first line), so a row that can't be read can be pointed at. */
  lines?: number[];
  /** The separator the file used: with semicolons, decimals take a comma. */
  sep?: string;
}

/**
 * Splits CSV text into rows of cells. Quotes may hold separators, quotes ("") and line breaks.
 * Cells are cut out with slice rather than built a character at a time: on the
 * phone's engine that is what made a 5,000-session file take seconds.
 */
export function parseCsv(text: string, sep = detectSeparator(text)): string[][] {
  const s = text.replace(/^\uFEFF/, '');
  const n = s.length;
  const SEP = sep.charCodeAt(0);
  const rows: string[][] = [];
  let row: string[] = [];
  // What a cell has so far from quoted parts; the unquoted run since `from` is added when it ends.
  let cell = '';
  let from = 0;
  let i = 0;
  // Past here a quote is just a character: one that never closes would otherwise swallow every row after it.
  let literal = n;
  while (i < n) {
    const ch = s.charCodeAt(i);
    if (ch === 34 /* " */ && i < literal && (cell + s.slice(from, i)).trim() === '') {
      // A quoted part: up to the closing quote, "" being a quote.
      const open = i;
      const before = cell;
      cell = '';
      i++;
      for (;;) {
        const q = s.indexOf('"', i);
        if (q < 0) {
          // Never closed: read it again as text, line by line.
          cell = before;
          literal = open;
          i = open + 1;
          break;
        }
        if (s.charCodeAt(q + 1) === 34) {
          cell += s.slice(i, q + 1);
          i = q + 2;
        } else {
          cell += s.slice(i, q);
          i = q + 1;
          break;
        }
      }
      from = i;
    } else if (ch === SEP) {
      row.push((cell + s.slice(from, i)).trim());
      cell = '';
      from = ++i;
    } else if (ch === 10 || ch === 13) {
      row.push((cell + s.slice(from, i)).trim());
      if (ch === 13 && s.charCodeAt(i + 1) === 10) i++;
      rows.push(row);
      row = [];
      cell = '';
      from = ++i;
    } else i++;
  }
  const last = cell + s.slice(from, n);
  if (last !== '' || row.length) {
    row.push(last.trim());
    rows.push(row);
  }
  // Text our own export kept from running as a formula ('=…, '-…): back to what was typed.
  for (const r of rows) for (let c = 0; c < r.length; c++) if (r[c].charCodeAt(0) === 39 && /^'[=+\-@\t\r]/.test(r[c])) r[c] = r[c].slice(1);
  return rows;
}

/** The separator that splits the first lines most evenly: comma, semicolon or tab. */
export function detectSeparator(text: string): string {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !/^-+[^,;\t]*-*$/.test(l.trim()))
    .slice(0, 20);
  let best = ',';
  let bestScore = 0;
  for (const sep of [',', ';', '\t']) {
    const counts = lines.map((l) => countOutsideQuotes(l, sep));
    const max = Math.max(0, ...counts);
    if (!max) continue;
    // Lines that agree with the most common count, weighted by how many columns that gives.
    const mode = mostCommon(counts.filter((c) => c > 0));
    const score = counts.filter((c) => c === mode).length * Math.log2(mode + 1);
    if (score > bestScore) {
      best = sep;
      bestScore = score;
    }
  }
  return best;
}

function countOutsideQuotes(line: string, sep: string): number {
  let n = 0;
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === sep && !q) n++;
  }
  return n;
}

function mostCommon(xs: number[]): number {
  const m = new Map<number, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  let best = 0;
  let bestN = 0;
  for (const [x, n] of m) if (n > bestN || (n === bestN && x > best)) [best, bestN] = [x, n];
  return best;
}

/** Lower case, no accents, letters and digits only: "Buy-in (€)" → "buyin". */
export function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * The header is the first row with at least two filled cells that looks like
 * names rather than data; `known` scores rows by how many cells it recognises.
 */
export function readTable(text: string, known: (h: string) => boolean): Table {
  const sep = detectSeparator(text);
  const parsed = parseCsv(text, sep);
  // Record number in the file; quoted line breaks inside a cell are rare enough to ignore.
  const lineOf: number[] = [];
  const all = parsed.filter((r, i) => r.some((c) => c !== '') && lineOf.push(i + 1) > 0);
  let at = -1;
  let fallback = -1;
  let bestHits = 0;
  for (let i = 0; i < Math.min(all.length, 15); i++) {
    const filled = all[i].filter((c) => c !== '');
    if (filled.length < 2) continue;
    const hits = filled.filter((c) => known(norm(c))).length;
    if (hits > bestHits) {
      bestHits = hits;
      at = i;
    }
    if (fallback < 0 && filled.every((c) => !/^[-+]?[\d.,:/ ]+$/.test(c))) fallback = i;
  }
  if (at < 0) at = fallback;
  if (at < 0) return { headers: [], rows: [], lines: [] };
  const headers = all[at].map((h, i) => h || `#${i + 1}`);
  const rows: string[][] = [];
  const lines: number[] = [];
  for (let i = at + 1; i < all.length; i++)
    if (all[i].filter((c) => c !== '').length >= 2) {
      rows.push(all[i]);
      lines.push(lineOf[i]);
    }
  return { headers, rows, lines, sep };
}
