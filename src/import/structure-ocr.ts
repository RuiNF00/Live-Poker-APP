// A printed blind structure, photographed: the phone's text recognition
// gives lines in whatever order it found them (whole rows, one cell at a
// time, or a column per block on Android). This turns them into the text a
// player would paste, one level per line ("100/200/200 40") and "Break 15"
// where the sheet has a break, so poker/tourney.ts parseStructure stays the
// only parser. Pure, so it can be tested.

const BLINDS = /^(\d[\d,.]*k?)\s*[/-]\s*(\d[\d,.]*k?)(?:\s*[/-]\s*(\d[\d,.]*k?))?$/i;
const BLINDS_IN = /(\d[\d,.]*k?)\s*[/-]\s*(\d[\d,.]*k?)/i;
const NUM = /^(\d[\d,.]*k?)\s*(?:m(?:in)?\.?|')?$/i;
const BREAK = /\b(break|pausa|intervalo|descanso|color\s*up|chip\s*race)\b/i;

function value(s: string): number {
  let v = s.trim().toLowerCase();
  const k = v.endsWith('k') ? 1000 : 1;
  v = v.replace(/k$/, '').replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.');
  const n = Number(v);
  return Number.isFinite(n) ? n * k : NaN;
}

/** "Break 15", "BREAK - 20 MIN", "Pausa 10'": its length, or 0 when none is given. */
function breakMinutes(s: string): number {
  const m = s.match(/(\d{1,3})\s*(?:m(?:in)?|')?/i);
  const n = m ? Number(m[1]) : 0;
  return n > 0 && n <= 120 ? n : 0;
}

const breakLine = (min: number) => (min ? `Break ${min}` : 'Break');

type Tok = { kind: 'blinds'; text: string } | { kind: 'num'; n: number; text: string } | { kind: 'break'; min: number } | { kind: 'row'; text: string } | { kind: 'other' };

function tokens(raw: string[]): Tok[] {
  const lines = raw.flatMap((l) => l.split(/\r?\n/)).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return lines.map((l): Tok => {
    if (BREAK.test(l)) return { kind: 'break', min: breakMinutes(l) };
    const b = l.replace(/^(level|lvl|nível|nivel|n\.?)\s*\d+\s*[:.-]?\s*/i, '');
    if (BLINDS.test(b)) return { kind: 'blinds', text: b };
    // Blinds and more on one line: already a pasteable row.
    if (BLINDS_IN.test(l)) return { kind: 'row', text: l };
    if (NUM.test(l)) {
      const n = value(l.match(NUM)![1]);
      if (Number.isFinite(n)) return { kind: 'num', n, text: l };
    }
    return { kind: 'other' };
  });
}

/** Runs of numbers as long as the blinds column, read as ante or minutes. */
function columnsFor(toks: Tok[], count: number): { ante?: number[]; minutes?: number[] } {
  const runs: number[][] = [];
  let cur: number[] = [];
  for (const x of toks) {
    if (x.kind === 'num') cur.push(x.n);
    else if (x.kind !== 'break') {
      if (cur.length) runs.push(cur);
      cur = [];
    }
  }
  if (cur.length) runs.push(cur);
  const fits = runs.filter((r) => r.length === count);
  // 1, 2, 3… is the level number.
  const cols = fits.filter((r) => !r.every((v, i) => v === i + 1 || v === i));
  const minutes = cols.find((r) => r.every((v) => v > 0 && v <= 120) && new Set(r).size <= Math.max(2, Math.ceil(r.length / 3)));
  const ante = cols.find((r) => r !== minutes);
  return { ante, minutes };
}

/** What the photo says, as pasteable structure text ('' when no level was found). */
export function ocrStructureText(raw: string[]): string {
  const toks = tokens(raw);
  const out: string[] = [];
  const blinds = toks.filter((x) => x.kind === 'blinds');
  let adjacent = 0;
  for (let i = 1; i < toks.length; i++) if (toks[i].kind === 'blinds' && toks[i - 1].kind === 'blinds') adjacent++;

  if (blinds.length >= 3 && adjacent >= Math.floor(blinds.length / 2)) {
    // A column of blinds (Android blocks, or a table read top to bottom per column).
    const { ante, minutes } = columnsFor(toks, blinds.length);
    let i = 0;
    for (const x of toks) {
      if (x.kind === 'break') out.push(breakLine(x.min));
      else if (x.kind === 'blinds') {
        const a = ante?.[i];
        const m = minutes?.[i];
        const head = x.text.replace(/\s+/g, '');
        out.push([a !== undefined && !BLINDS.exec(x.text)?.[3] ? `${head}/${a}` : head, m ?? ''].filter((v) => v !== '').join(' '));
        i++;
      }
    }
    return out.join('\n');
  }

  // Rows, whole or a cell at a time: each blinds cell takes the numbers after it, up to the next level.
  for (let i = 0; i < toks.length; i++) {
    const x = toks[i];
    if (x.kind === 'row') out.push(x.text);
    else if (x.kind === 'break') out.push(breakLine(x.min));
    else if (x.kind === 'blinds') {
      const after: number[] = [];
      let j = i + 1;
      for (let t = toks[j]; t?.kind === 'num'; t = toks[++j]) after.push(t.n);
      // The cell before the next blinds is that level's number (1, 2, 3…): not ours.
      const next = toks[j];
      const level = out.filter((l) => !BREAK.test(l)).length + 2;
      if (next?.kind === 'blinds' && after.length && after[after.length - 1] === level) after.pop();
      const hasAnte = !!BLINDS.exec(x.text)?.[3];
      const parts = after.slice(0, hasAnte ? 1 : 2);
      out.push([x.text.replace(/\s+/g, ''), ...parts].join(' '));
      i = j - 1;
    }
  }
  return out.join('\n');
}
