// CSV reading for imports from other apps. Exports differ in separator (comma,
// semicolon in Europe, tab), quoting and the junk above the header (Poker
// Bankroll Tracker writes "---PBT Bankroll Export---" first), so all of that
// is worked out from the text itself. Pure, so it can be tested.

export interface Table {
  headers: string[];
  rows: string[][];
  /** Line in the file of each row (1 = first line), so a row that can't be read can be pointed at. */
  lines?: number[];
}

/** Splits CSV text into rows of cells. Quotes may hold separators, quotes ("") and line breaks. */
export function parseCsv(text: string, sep = detectSeparator(text)): string[][] {
  const s = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell.trim() === '') {
      cell = '';
      quoted = true;
    } else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim()));
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
  const parsed = parseCsv(text);
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
  return { headers, rows, lines };
}
