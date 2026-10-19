// "Nível 12, stack 45 mil", "rebuy", "restam 80": what the player says between
// hands, turned into the same changes the session screen makes with taps.
// Pure and on the phone, like voice.ts, whose words and numbers it reuses: the
// text comes from the keyboard's dictation and never leaves it.

import { levelAfter } from '@/lib/lock-screen/live-state';
import { isPaused } from '@/store/session-math';
import type { Session } from '@/store/types';

import { normalise, readNumber } from './voice';

export type LiveChange =
  | { k: 'stack'; v: number; inBB?: boolean }
  | { k: 'level'; v: number }
  | { k: 'levelStep'; dir: 1 | -1 }
  | { k: 'blinds'; sb: number; bb: number; ante?: number }
  | { k: 'rebuy' }
  | { k: 'addon' }
  | { k: 'pause' }
  | { k: 'resume' }
  | { k: 'left'; v: number }
  | { k: 'entries'; v: number }
  | { k: 'note'; text: string };

const LEVEL = new Set(['nivel', 'level', 'lvl']);
const UP = new Set(['sobe', 'subiu', 'subir', 'up', 'sube', 'subio', 'proximo', 'next', 'seguinte', 'siguiente', 'novo', 'nuevo', 'new']);
const DOWN = new Set(['desce', 'desceu', 'down', 'baja', 'bajo', 'anterior', 'previous', 'back']);
const BLINDS = new Set(['blinds', 'blind', 'ciegas', 'estrutura']);
const ANTE = new Set(['ante', 'antes', 'bba']);
const STACK = new Set(['stack', 'fichas', 'chips', 'pilha']);
/** "Tenho 45 mil", "estou com 45 mil", "I have 45k", "tengo 45 mil". */
const HAVE = new Set(['tenho', 'tinha', 'tengo', 'tenia', 'have', 'had', 'got', 'com', 'con', 'at', 'on']);
const REBUY = new Set(['rebuy', 'rebuys', 'recompra', 'recompro', 'recomprei', 'recompre', 'reentry', 'reentrada', 'reentro', 'reentrei', 'reentre', 'reentrar']);
const PAUSE = new Set(['pausa', 'intervalo', 'break', 'descanso', 'jantar', 'cena', 'dinner']);
// "Não há pausa", "sin rebuy", "I didn't rebuy": the word is there, the change isn't.
const NEG = new Set(['nao', 'sem', 'nem', 'sin', 'ni', 'not', 'without', 'didnt', 'dont', 'havent', 'never', 'nunca']);
const NO_VERB = new Set(['hay', 'hubo', 'hice', 'fiz', 'tengo', 'tenho', 'vou', 'voy', 'more']);
function negated(w: string[], i: number): boolean {
  for (let j = Math.max(0, i - 3); j < i; j++) {
    if (NEG.has(w[j])) return true;
    // "no" is also pt "in the" ("no intervalo"): a negation only before a verb, or in English.
    if (w[j] === 'no' && (NO_VERB.has(w[j + 1] ?? '') || (j === i - 1 && ['break', 'rebuy', 'addon', 'dinner', 'add'].includes(w[i])))) return true;
  }
  return false;
}
// "No intervalo comi", "fui ao bar no intervalo": the break as a time, not a pause now, unless
// the player is in it ("estou no intervalo", "vamos a cenar").
const WHEN = new Set(['no', 'na', 'ao', 'a', 'durante', 'during', 'en', 'in', 'at', 'on']);
const BEING = new Set(['estou', 'tou', 'to', 'estamos', 'estoy', 'im', 'were', 'vamos', 'vou', 'voy', 'fomos', 'going', 'entramos', 'entrei', 'are', 'am', 'is', 'go']);
function asTime(w: string[], i: number): boolean {
  let j = i - 1;
  if (['the', 'el', 'o', 'a', 'um', 'una'].includes(w[j] ?? '') && WHEN.has(w[j - 1] ?? '')) j--;
  // "On break" said alone is being on it.
  if (w[j] === 'on' && j === 0) return false;
  return WHEN.has(w[j] ?? '') && !BEING.has(w[j - 1] ?? '');
}
const RESUME = new Set(['retomar', 'retomo', 'retomei', 'voltei', 'volto', 'resume', 'resumed', 'seguimos', 'continuo', 'continuar', 'continua', 'vuelvo', 'volvi', 'regreso', 'regrese', 'reanudo', 'recomeca', 'recomeco']);
const LEFT = new Set(['restam', 'faltam', 'sobram', 'sobraram', 'ficam', 'ficaram', 'restan', 'restaban', 'quedan', 'quedamos', 'faltan', 'left', 'remaining', 'remain', 'somos', 'sobran']);
const PLAYERS = new Set(['jogadores', 'jugadores', 'players', 'pessoas', 'personas', 'people']);
const ENTRIES = new Set(['inscritos', 'inscricoes', 'entradas', 'entries', 'entrants', 'field', 'entrantes']);
const BB_UNIT = new Set(['bb', 'bbs', 'blinds', 'grandes', 'ciegas', 'big']);
/** Words that may sit between a keyword and its number: "stack de 45 mil", "level is 12". */
const FILLER = new Set(['de', 'do', 'da', 'del', 'o', 'a', 'el', 'la', 'the', 'my', 'meu', 'mi', 'is', 'e', 'em', 'en', 'para', 'pra', 'to', 'of', 'agora', 'now', 'ahora', 'ja', 'ya', 'mais', 'menos', 'cerca', 'about', 'around', 'unos', 'uns']);

interface Span {
  start: number;
  next: number;
  value: number;
  used?: boolean;
}

/** Everything said, in order. Empty when nothing was understood. */
export function liveChanges(text: string): LiveChange[] {
  const out: LiveChange[] = [];
  // A note takes the rest of what was said, as said (accents and case kept).
  const nm = /(?:^|[\s,.;])(?:nota|note|anota|apunta|apunte)\b\s*[:,-]?\s*([\s\S]+)$/i.exec(text);
  const head = nm ? text.slice(0, nm.index) : text;
  const w = normalise(head).words;
  const nums: Span[] = [];
  for (let i = 0; i < w.length; ) {
    const n = readNumber(w, i);
    if (n && !(w[i] === 'a' || w[i] === 'o')) {
      nums.push({ start: i, next: n.next, value: n.value });
      i = n.next;
    } else i++;
  }
  /** The number right after word i (fillers skipped), or right before it. */
  const numAfter = (i: number): Span | undefined => {
    let j = i + 1;
    while (j < w.length && (FILLER.has(w[j]) || (j === i + 1 && w[j] === ',')) && !nums.some((s) => s.start === j)) j++;
    return nums.find((s) => s.start === j && !s.used);
  };
  const numBefore = (i: number): Span | undefined => {
    let j = i - 1;
    while (j >= 0 && FILLER.has(w[j]) && !nums.some((s) => s.next === j + 1)) j--;
    return nums.find((s) => s.next === j + 1 && !s.used);
  };
  const take = (s: Span | undefined) => (s ? ((s.used = true), s.value) : undefined);
  // Chips said in big blinds: "30 bb", "trinta blinds".
  const unit = (s: Span) => (BB_UNIT.has(w[s.next] ?? '') ? 'bb' : 'chips');

  const stackFrom = (s: Span) => {
    s.used = true;
    out.push(unit(s) === 'bb' ? { k: 'stack', v: s.value, inBB: true } : { k: 'stack', v: s.value });
  };

  for (let i = 0; i < w.length; i++) {
    const x = w[i];
    if (LEVEL.has(x)) {
      // "Subiu o nível", "next level", "nivel siguiente".
      const near = [w[i - 2], w[i - 1], w[i + 1], w[i + 2]];
      const after = numAfter(i);
      // "Nível 12 blinds 600 1200" with no comma: "blinds" starts the blinds, it isn't 12 bb.
      const bbAfter = BB_UNIT.has(w[after?.next ?? -1] ?? '') && !nums.some((s) => s.start === after!.next + 1);
      if (after && !(bbAfter || w[after.next] === '/')) {
        out.push({ k: 'level', v: Math.round(take(after)!) });
        continue;
      }
      if (near.some((y) => y && UP.has(y))) out.push({ k: 'levelStep', dir: 1 });
      else if (near.some((y) => y && DOWN.has(y))) out.push({ k: 'levelStep', dir: -1 });
      continue;
    }
    if (BLINDS.has(x) || nums.some((s) => s.start === i && w[s.next] === '/')) {
      // "Blinds 1000/2000 ante 2000", "2000 4000 ante 4000".
      let a = BLINDS.has(x) ? numAfter(i) : nums.find((s) => s.start === i && !s.used);
      if (!a) continue;
      let k = a.next;
      if (w[k] === '/' || w[k] === 'e' || w[k] === 'y' || w[k] === 'and') k++;
      const b = nums.find((s) => s.start === k && !s.used);
      if (!b) continue;
      a.used = b.used = true;
      let ante: number | undefined;
      const an = w.slice(b.next, b.next + 3).findIndex((y) => ANTE.has(y));
      if (an >= 0) ante = take(numAfter(b.next + an));
      out.push({ k: 'blinds', sb: Math.min(a.value, b.value), bb: Math.max(a.value, b.value), ...(ante !== undefined ? { ante } : {}) });
      i = b.next - 1;
      continue;
    }
    if ((REBUY.has(x) || (x === 're' && w[i + 1] === 'entry')) && !negated(w, i)) {
      out.push({ k: 'rebuy' });
      continue;
    }
    if ((x === 'addon' || (x === 'add' && w[i + 1] === 'on')) && !negated(w, i)) {
      out.push({ k: 'addon' });
      continue;
    }
    if (PAUSE.has(x) && !negated(w, i) && !asTime(w, i) && w[i - 1] !== 'do' && w[i - 1] !== 'del' && w[i - 1] !== 'after' && w[i - 1] !== 'depois') {
      out.push({ k: 'pause' });
      continue;
    }
    if (RESUME.has(x) || (x === 'back' && !LEVEL.has(w[i + 1] ?? ''))) {
      out.push({ k: 'resume' });
      continue;
    }
    if (LEFT.has(x)) {
      // "Restam 45", "45 left", "quedan 45 jugadores".
      const s = numAfter(i) ?? numBefore(i) ?? (PLAYERS.has(w[i - 1] ?? '') ? numBefore(i - 1) : undefined);
      const v = take(s);
      if (v) out.push({ k: 'left', v: Math.round(v) });
      continue;
    }
    if (ENTRIES.has(x)) {
      const v = take(numBefore(i) ?? numAfter(i));
      if (v) out.push({ k: 'entries', v: Math.round(v) });
      continue;
    }
    if (STACK.has(x)) {
      const s = numAfter(i) ?? numBefore(i);
      if (s) stackFrom(s);
      continue;
    }
    if (HAVE.has(x)) {
      // "Estou com 45 mil", "tenho 30 bb": a number right after is the stack.
      const s = nums.find((n) => n.start === i + 1 && !n.used);
      if (s && (x !== 'com' && x !== 'con' && x !== 'at' && x !== 'on' ? true : ['estou', 'tou', 'to', 'estoy', 'sigo', 'fico', 'quedo', 'im', 'vou', 'voy', 'ando'].includes(w[i - 1] ?? '') || STACK.has(w[s.next] ?? '') || BB_UNIT.has(w[s.next] ?? '') || w[s.next] === 'mil')) {
        stackFrom(s);
      }
      continue;
    }
  }
  // "Estou short, 8 bb": a count of big blinds nothing else took is the stack.
  if (!out.some((c) => c.k === 'stack')) {
    const bb = nums.find((n) => !n.used && unit(n) === 'bb');
    if (bb) stackFrom(bb);
  }
  // "45 mil" said alone: the stack, the thing players update most.
  if (!out.length && nums.length === 1 && w.every((y, k) => (k >= nums[0].start && k < nums[0].next) || BB_UNIT.has(y) || FILLER.has(y) || y === ',')) stackFrom(nums[0]);
  if (nm && nm[1].trim()) out.push({ k: 'note', text: nm[1].trim() });
  return out;
}

/** The session after what was said, as the screen's own buttons would leave it. */
export function applyLive(s: Session, changes: LiveChange[], now = Date.now()): Partial<Session> {
  let n: Session = { ...s };
  let stackSet = false;
  for (const c of changes) {
    if (c.k === 'level') {
      const st = n.kind === 'mtt' ? n.tourney?.structure : undefined;
      // With a structure the blinds follow the level; without one only the number changes.
      n = { ...n, ...(st?.length ? levelAfter({ ...n, level: Math.max(0, c.v - 1) }, 1) : { level: c.v }) };
    } else if (c.k === 'levelStep') n = { ...n, ...levelAfter(n, c.dir) };
    else if (c.k === 'blinds') {
      const ante = c.ante ?? (n.anteType === 'bb' ? c.bb : n.anteType === 'all' ? n.ante : 0);
      n = { ...n, sb: c.sb, bb: c.bb, ante };
    } else if (c.k === 'rebuy') {
      const first = n.stackLog[0]?.stack ?? n.stack;
      const stack = n.kind === 'mtt' ? n.tourney?.startStack || first : n.stack + n.buyIn;
      n = { ...n, entries: n.entries + 1, stack };
      stackSet = true;
    } else if (c.k === 'addon') n = { ...n, addOn: (n.addOn || 0) + n.buyIn };
    else if (c.k === 'stack') {
      n = { ...n, stack: Math.round(c.inBB ? c.v * n.bb : c.v) };
      stackSet = true;
    } else if (c.k === 'pause') {
      if (!isPaused(n)) n = { ...n, breaks: [...n.breaks, { start: now }] };
    } else if (c.k === 'resume') {
      if (isPaused(n)) n = { ...n, breaks: n.breaks.map((b, i) => (i === n.breaks.length - 1 ? { ...b, end: now } : b)) };
    } else if (c.k === 'left') {
      if (n.kind === 'mtt') n = { ...n, tourney: { ...n.tourney, left: c.v } };
    } else if (c.k === 'entries') {
      if (n.kind === 'mtt') n = { ...n, tourney: { ...n.tourney, entries: c.v } };
    } else if (c.k === 'note') n = { ...n, notes: n.notes ? `${n.notes}\n${c.text}` : c.text };
  }
  if (stackSet) n = { ...n, stackLog: [...s.stackLog, { t: now, stack: n.stack, level: n.level }] };
  // Only what changed, so "Anular" puts back exactly that.
  const patch: Partial<Session> = {};
  for (const k of Object.keys(n) as (keyof Session)[]) if (n[k] !== s[k]) (patch as Record<string, unknown>)[k] = n[k];
  return patch;
}
