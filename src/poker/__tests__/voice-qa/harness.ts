// QA harness for src/poker/voice.ts (read-only import from the worktree).
import { positions, replay, totalPot } from '../../engine';
import type { GameInfo, Hand } from '../../types';
import { handFromSpeech } from '../../voice';

export const MTT: GameInfo = { kind: 'mtt', name: 'T', sb: 200, bb: 400, ante: 400, anteType: 'bb', currency: '€' };
export const CASH: GameInfo = { kind: 'cash', name: '', sb: 1, bb: 2, ante: 0, anteType: 'none', currency: '€' };

export function base(game: GameInfo = MTT, n = 9): Hand {
  const stack = game.bb * 100;
  return {
    v: 1, id: 't', createdAt: 0, updatedAt: 0, game,
    players: Array.from({ length: n }, (_, i) => ({ name: i ? '' : 'Hero', stack })),
    button: 0, hero: 0, actions: [], board: [], tags: [], notes: '',
  };
}

export function line(h: Hand, all = false) {
  const pos = positions(h.players.length, h.button);
  return h.actions
    .filter((a) => all || (a.kind !== 'fold' && a.kind !== 'check'))
    .map((a) => `${pos[a.p]} ${a.kind === 'check' ? 'k' : a.kind[0]}${a.to ?? ''}`)
    .join(', ');
}

export interface Exp {
  pos?: string;
  hc?: string; // 'AhKh' exact, 'AK' ranks, 'AKs'/'AKo' ranks + suitedness
  line?: string | RegExp;
  board?: string; // ranks
  boardExact?: string[];
  n?: number;
  empty?: boolean;
  notes?: string[];
  heroStack?: number;
  bb?: number;
  shows?: Record<string, string>; // pos -> ranks
  foldWin?: boolean;
}

export interface Case { lang: string; text: string; exp: Exp; game?: GameInfo; n?: number }

export function run(c: Case) {
  const b = base(c.game ?? MTT, c.n ?? 9);
  const t0 = performance.now();
  let r;
  try {
    r = handFromSpeech(c.text, b);
  } catch (e) {
    return { ok: false, errs: ['THROW ' + (e as Error).message], summary: '', ms: performance.now() - t0 };
  }
  const ms = performance.now() - t0;
  const h = r.hand;
  const pos = positions(h.players.length, h.button);
  const rp = replay(h);
  const errs: string[] = [];
  const inv: string[] = [];
  // invariants
  const all = [...h.board, ...h.players.flatMap((p) => p.cards ?? [])];
  if (new Set(all).size !== all.length) inv.push('DUP CARDS ' + all.join(' '));
  if (all.some((c) => !/^[AKQJT2-9][shdc]$/.test(c))) inv.push('BAD CARD ' + all.join(' '));
  if (rp.invalidAt !== null) inv.push('INVALID at ' + rp.invalidAt);
  if (h.players.some((p) => !(p.stack > 0) || !Number.isFinite(p.stack))) inv.push('BAD STACK ' + h.players.map((p) => p.stack).join(','));
  if (h.actions.some((a) => a.to !== undefined && (!Number.isFinite(a.to) || a.to <= 0))) inv.push('BAD TO');
  if (h.players[h.hero].cards && h.players[h.hero].cards!.length !== 2) inv.push('HERO CARDS ' + h.players[h.hero].cards);
  if (h.board.length > 5) inv.push('BOARD>5');
  const e = c.exp;
  const hc = h.players[h.hero].cards ?? [];
  if (e.empty !== undefined && r.empty !== e.empty) errs.push(`empty=${r.empty}`);
  if (e.pos && pos[h.hero] !== e.pos) errs.push(`pos=${pos[h.hero]} want ${e.pos}`);
  if (e.n && h.players.length !== e.n) errs.push(`n=${h.players.length} want ${e.n}`);
  if (e.hc) {
    const rk = hc.map((x) => x[0]).join('');
    const sorted = (s: string) => s.split('').sort().join('');
    if (e.hc.length === 4) { if (hc.join('') !== e.hc && hc.slice().reverse().join('') !== e.hc) errs.push(`hc=${hc.join('')} want ${e.hc}`); }
    else {
      if (sorted(rk) !== sorted(e.hc.slice(0, 2))) errs.push(`hc=${hc.join('')} want ${e.hc}`);
      if (e.hc[2] === 's' && hc.length === 2 && hc[0][1] !== hc[1][1]) errs.push('not suited');
      if (e.hc[2] === 'o' && hc.length === 2 && hc[0][1] === hc[1][1]) errs.push('not offsuit');
    }
  }
  const ln = line(h);
  if (e.line !== undefined) {
    if (typeof e.line === 'string' ? ln !== e.line : !e.line.test(ln)) errs.push(`line=[${ln}] want [${e.line}]`);
  }
  const br = h.board.map((x) => x[0]).join('');
  if (e.board !== undefined && br !== e.board) errs.push(`board=${br} want ${e.board}`);
  if (e.boardExact && e.boardExact.some((x, i) => h.board[i] !== x)) errs.push(`board=${h.board.join('')} want ${e.boardExact.join('')}`);
  if (e.notes) for (const nn of e.notes) if (!r.notes.some((x) => x.code === nn)) errs.push(`missing note ${nn}`);
  if (e.heroStack !== undefined && h.players[h.hero].stack !== e.heroStack) errs.push(`heroStack=${h.players[h.hero].stack} want ${e.heroStack}`);
  if (e.bb !== undefined && h.game.bb !== e.bb) errs.push(`bb=${h.game.bb} want ${e.bb}`);
  if (e.shows) for (const [p, rr] of Object.entries(e.shows)) {
    const s = pos.indexOf(p);
    const got = s >= 0 ? (h.players[s].cards ?? []).map((x) => x[0]).join('') : '?';
    if (got.split('').sort().join('') !== rr.split('').sort().join('')) errs.push(`${p} shows ${got} want ${rr}`);
  }
  if (e.foldWin !== undefined && !!rp.final.foldWin !== e.foldWin) errs.push(`foldWin=${rp.final.foldWin}`);
  if (ms > 300) inv.push(`SLOW ${ms.toFixed(0)}ms`);
  const shows = h.players.map((p, i) => (i !== h.hero && p.cards ? `${pos[i]}:${p.cards.join('')}` : '')).filter(Boolean).join(' ');
  const summary = `n=${h.players.length} pos=${pos[h.hero]}${r.posKnown ? '' : '?'} hc=${hc.join('')} bb=${h.game.sb}/${h.game.bb}/a${h.game.ante} stk=${h.players[h.hero].stack} | ${line(h, true)} | board=${h.board.join('')} ${shows} | notes=${r.notes.map((x) => x.code + (x.pos ? ':' + x.pos : '') + (x.street ? '@' + x.street : '')).join(',')} empty=${r.empty} pot=${totalPot(rp.final as never) ?? ''}`;
  return { ok: errs.length === 0 && inv.length === 0, errs: [...inv, ...errs], summary, ms, inv };
}

export function report(cases: Case[], verbose = false) {
  const byLang: Record<string, { ok: number; n: number }> = {};
  for (const c of cases) {
    const r = run(c);
    byLang[c.lang] ??= { ok: 0, n: 0 };
    byLang[c.lang].n++;
    if (r.ok) byLang[c.lang].ok++;
    if (!r.ok || verbose) {
      console.log(`\n[${c.lang}] ${r.ok ? 'OK ' : 'FAIL'} ${c.text}`);
      console.log('   ' + r.summary);
      if (!r.ok) console.log('   >> ' + r.errs.join(' ; '));
    }
  }
  console.log('\n' + JSON.stringify(byLang));
}
