// PokerStars hand-history text: the format GTO Wizard, PioSolver, Hold'em
// Manager and PokerTracker all import. Real seat numbers, stacks, blinds and
// antes, every action with Stars' wording, board, showdown and summary.
// Opponents are named by position, so table reads never leave the phone.

import { positions, replay, straddleSeats, totalPot, type HandResult, type Replay } from './engine';
import type { Hand, Street } from './types';

const STREET_NAME: Record<Street, string> = { preflop: 'Flop', flop: 'Flop', turn: 'Turn', river: 'River' };
const CURRENCY: Record<string, string> = { '€': 'EUR', $: 'USD', '£': 'GBP' };

/** Stable 12-digit number from a string, so the same hand always gets the same id. */
function num(s: string, digits = 12): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
  }
  const n = (h1 % 1e6).toString().padStart(6, '0') + (h2 % 1e6).toString().padStart(6, '0');
  return (Number(n[0]) === 0 ? '1' + n.slice(1) : n).slice(0, digits);
}

function roman(n: number): string {
  const map: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of map)
    while (n >= v) {
      out += s;
      n -= v;
    }
  return out;
}

function utcTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ${d.getUTCHours()}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC`;
}

/**
 * Chips each player won on each run: one row, or two when the hand was run
 * twice (each run plays for half of every pot, the odd chip with the first).
 */
export function runWinnings(res: HandResult): number[][] {
  if (!res.pots.some((p) => p.winners2 !== undefined)) return [res.won];
  const runs = [new Array(res.won.length).fill(0), new Array(res.won.length).fill(0)];
  const pay = (row: number[], amount: number, winners: number[] | null | undefined) => {
    if (!winners?.length) return;
    const share = Math.floor(amount / winners.length);
    let odd = amount - share * winners.length;
    for (const w of winners) {
      row[w] += share + (odd > 0 ? 1 : 0);
      if (odd > 0) odd--;
    }
  };
  for (const p of res.pots) {
    const first = Math.ceil(p.amount / 2);
    pay(runs[0], first, p.winners);
    pay(runs[1], p.amount - first, p.winners2);
  }
  return runs;
}

/** US Eastern time, as Stars prints it: "2026/10/17 7:04:09 ET". */
export function easternTime(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  // DST: second Sunday of March 2:00 to first Sunday of November 2:00 (local).
  const sunday = (month: number, nth: number) => {
    const first = new Date(Date.UTC(y, month, 1)).getUTCDay();
    return 1 + ((7 - first) % 7) + (nth - 1) * 7;
  };
  const start = Date.UTC(y, 2, sunday(2, 2), 7);
  const end = Date.UTC(y, 10, sunday(10, 1), 6);
  const e = new Date(ms - (ms >= start && ms < end ? 4 : 5) * 3_600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${e.getUTCFullYear()}/${p(e.getUTCMonth() + 1)}/${p(e.getUTCDate())} ${e.getUTCHours()}:${p(e.getUTCMinutes())}:${p(e.getUTCSeconds())} ET`;
}

const clean = (s: string) => s.replace(/['\n\r]/g, '').trim();

export function pokerStarsText(hand: Hand, r: Replay = replay(hand)): string {
  const g = hand.game;
  const n = hand.players.length;
  const pos = positions(n, hand.button);
  const name = (i: number) => (i === hand.hero ? 'Hero' : pos[i]);
  const cash = g.kind === 'cash';
  const sym = cash ? (CURRENCY[g.currency] ? g.currency : '$') : '';
  const code = CURRENCY[g.currency] ?? 'USD';
  const fmt = (v: number) => (cash ? sym + (Number.isInteger(v) ? String(v) : v.toFixed(2)) : String(Math.round(v)));
  const out: string[] = [];

  const id = num(hand.id + ':' + hand.createdAt);
  // Stars' "local [ET]" form; parsers that want the bracketed ET accept it, and so do the rest.
  const when = `${utcTime(hand.createdAt)} [${easternTime(hand.createdAt)}]`;
  if (cash) out.push(`PokerStars Hand #${id}:  Hold'em No Limit (${fmt(g.sb)}/${fmt(g.bb)} ${code}) - ${when}`);
  else {
    const tid = num(hand.sessionId || g.name || hand.id, 10);
    const buyIn = g.buyIn ? `${g.currency in CURRENCY ? g.currency : '$'}${g.buyIn}+${g.currency in CURRENCY ? g.currency : '$'}0 ${code}` : 'Freeroll';
    out.push(`PokerStars Hand #${id}: Tournament #${tid}, ${buyIn} Hold'em No Limit - Level ${roman(g.level || 1)} (${fmt(g.sb)}/${fmt(g.bb)}) - ${when}`);
  }
  // Stars has no bomb pots; the table name is free text trackers keep, so the note goes there.
  const base = cash ? clean(g.name || g.venue || 'Sweatbook') : `${num(hand.sessionId || g.name || hand.id, 10)} 1`;
  const table = g.bombPot ? `${base} - Bomb pot ${fmt(g.bombPot)}` : base;
  out.push(`Table '${table}' ${n <= 2 ? 2 : n <= 6 ? 6 : n <= 9 ? 9 : 10}-max Seat #${hand.button + 1} is the button`);
  hand.players.forEach((p, i) => out.push(`Seat ${i + 1}: ${name(i)} (${fmt(p.stack)} in chips)`));

  // Forced bets, read from the engine's opening state so short stacks post what they had.
  const s0 = r.steps[0].state;
  for (let i = 0; i < n; i++) if (s0.antes[i] > 0) out.push(`${name(i)}: posts the ante ${fmt(s0.antes[i])}${s0.allIn[i] && !s0.bets[i] ? ' and is all-in' : ''}`);
  const sbI = n === 2 ? hand.button : (hand.button + 1) % n;
  const bbI = n === 2 ? (hand.button + 1) % n : (hand.button + 2) % n;
  if (s0.bets[sbI] > 0) out.push(`${name(sbI)}: posts small blind ${fmt(s0.bets[sbI])}${s0.allIn[sbI] ? ' and is all-in' : ''}`);
  if (s0.bets[bbI] > 0) out.push(`${name(bbI)}: posts big blind ${fmt(s0.bets[bbI])}${s0.allIn[bbI] ? ' and is all-in' : ''}`);
  // Live straddles, the way Hold'em Manager and PokerTracker read them.
  for (const [i] of straddleSeats(hand)) if (s0.bets[i] > 0) out.push(`${name(i)}: posts straddle ${fmt(s0.bets[i])}${s0.allIn[i] ? ' and is all-in' : ''}`);

  out.push('*** HOLE CARDS ***');
  const heroCards = hand.players[hand.hero].cards;
  if (heroCards?.length === 2) out.push(`Dealt to Hero [${heroCards.join(' ')}]`);

  // Run it twice: streets dealt after the all-in come out once per run.
  const twice = r.boards.length === 2 && r.runoutFrom !== null;
  const street = (count: number, cards: string[], run = '') => {
    const head = `${run}${count === 3 ? 'FLOP' : count === 4 ? 'TURN' : 'RIVER'}`;
    return count === 3 ? `*** ${head} *** [${cards.slice(0, 3).join(' ')}]` : `*** ${head} *** [${cards.slice(0, count - 1).join(' ')}] [${cards[count - 1]}]`;
  };
  const foldedOn: (Street | null)[] = new Array(n).fill(null);
  for (let k = 1; k < r.steps.length; k++) {
    const st = r.steps[k];
    const prev = r.steps[k - 1].state;
    if (st.kind === 'board') {
      const c = st.state.boardCount;
      out.push(street(c, hand.board, twice && c > r.runoutFrom! ? 'FIRST ' : ''));
      continue;
    }
    if (st.kind !== 'action' || !st.state.last) continue;
    const a = st.state.last;
    const allIn = a.allIn ? ' and is all-in' : '';
    if (a.kind === 'fold') {
      out.push(`${name(a.p)}: folds`);
      foldedOn[a.p] = st.actStreet ?? st.street;
    } else if (a.kind === 'check') out.push(`${name(a.p)}: checks`);
    else if (a.kind === 'call') out.push(`${name(a.p)}: calls ${fmt(a.added)}${allIn}`);
    else if (prev.currentBet > 0) out.push(`${name(a.p)}: raises ${fmt(a.to - prev.currentBet)} to ${fmt(a.to)}${allIn}`);
    else out.push(`${name(a.p)}: bets ${fmt(a.to)}${allIn}`);
    // Chips nobody matched come back when the street closes.
    for (let i = 0; i < n; i++) {
      const back = prev.invested[i] + (i === a.p ? a.added : 0) - st.state.invested[i];
      if (back > 0) out.push(`Uncalled bet (${fmt(back)}) returned to ${name(i)}`);
    }
  }

  if (twice) for (const c of [3, 4, 5]) if (c > r.runoutFrom!) out.push(street(c, r.boards[1], 'SECOND '));

  const res = r.result;
  const fin = r.final;
  const shows = (i: number) => !fin.folded[i] && hand.players[i].cards?.length === 2;
  const runs = res ? runWinnings(res) : [];
  runs.forEach((won, k) => {
    if (!fin.foldWin) {
      out.push(twice ? `*** ${k ? 'SECOND' : 'FIRST'} SHOW DOWN ***` : '*** SHOW DOWN ***');
      for (let i = 0; i < n; i++) if (!fin.folded[i]) out.push(shows(i) ? `${name(i)}: shows [${hand.players[i].cards!.join(' ')}]` : `${name(i)}: mucks hand`);
    }
    won.forEach((w, i) => w > 0 && out.push(`${name(i)} collected ${fmt(w)} from pot`));
  });

  const pot = res ? res.pots.reduce((x, p) => x + p.amount, 0) : totalPot(fin);
  out.push('*** SUMMARY ***');
  out.push(`Total pot ${fmt(pot)} | Rake ${fmt(0)}`);
  if (twice) out.push('Hand was run twice', `FIRST Board [${r.boards[0].join(' ')}]`, `SECOND Board [${r.boards[1].join(' ')}]`);
  else if (fin.boardCount) out.push(`Board [${hand.board.slice(0, fin.boardCount).join(' ')}]`);
  for (let i = 0; i < n; i++) {
    const role = i === hand.button ? ' (button)' : g.bombPot ? '' : i === sbI ? ' (small blind)' : i === bbI ? ' (big blind)' : '';
    const won = res?.won[i] ?? 0;
    let what: string;
    if (foldedOn[i]) {
      const f = foldedOn[i]!;
      what = f === 'preflop' ? `folded before Flop${s0.bets[i] === 0 && fin.invested[i] === 0 ? " (didn't bet)" : ''}` : `folded on the ${STREET_NAME[f]}`;
    } else if (res && fin.foldWin) what = `collected (${fmt(won)})`;
    else if (shows(i)) what = `showed [${hand.players[i].cards!.join(' ')}] and ${won > 0 ? `won (${fmt(won)})` : 'lost'}`;
    else what = won > 0 ? `collected (${fmt(won)})` : 'mucked';
    out.push(`Seat ${i + 1}: ${name(i)}${role} ${what}`);
  }
  return out.join('\n');
}

/** Several hands in one file, oldest first, separated the way Stars does. */
export function pokerStarsFile(hands: Hand[]): string {
  return [...hands]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((h) => pokerStarsText(h))
    .join('\n\n\n')
    .concat('\n');
}
