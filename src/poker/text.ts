import { positions, replay, totalPot, type LastAction } from './engine';
import { chips } from './format';
import type { Hand, Street } from './types';

// Forum hand history (TwoPlusTwo, Reddit r/poker, WhatsApp groups): the
// standard plain-text layout players already read, in English poker notation
// with every amount in big blinds. Opponents are named by position only, so a
// table read never ends up on a public forum.

const STAGE_EN: Record<string, string> = { early: 'Early', mid: 'Middle stages', bubble: 'Bubble', itm: 'ITM', ft: 'Final table', hu: 'Heads-up' };
const STREET_EN: Record<Street, string> = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' };

/** 135 chips at 2 bb → "67.5 bb". Always a decimal point: forums are read in English. */
function inBB(n: number, bb: number) {
  if (!bb) return chips(n);
  const v = Math.round((n / bb) * 10) / 10;
  return `${Number.isInteger(v) ? v : v.toFixed(1)} bb`;
}

function verb(a: LastAction, bb: number): string {
  const amt = inBB(a.kind === 'call' ? a.added : a.to, bb);
  switch (a.kind) {
    case 'fold':
      return 'folds';
    case 'check':
      return 'checks';
    case 'call':
      return a.allIn ? `calls ${amt} all-in` : `calls ${amt}`;
    case 'bet':
      return a.allIn ? `bets ${amt} all-in` : `bets ${amt}`;
    case 'raise':
      return a.allIn ? `raises to ${amt} all-in` : `raises to ${amt}`;
  }
}

export interface ForumTextOptions {
  /** Link to the replay, added at the end. */
  link?: string;
  /** "Shared with Sweatbook" line, on the free plan. */
  brand?: boolean;
  /** Include hero's notes. */
  notes?: boolean;
}

export function forumText(hand: Hand, opts: ForumTextOptions = {}): string {
  const r = replay(hand);
  const pos = positions(hand.players.length, hand.button);
  const g = hand.game;
  const bb = g.bb;
  const who = (i: number) => (i === hand.hero ? 'Hero' : pos[i]);
  const out: string[] = [];

  const ante = g.ante > 0 && g.anteType !== 'none' ? ` (${chips(g.ante)} ${g.anteType === 'bb' ? 'BB ante' : 'ante'})` : '';
  out.push(
    [
      "NL Hold'em",
      g.kind === 'mtt' ? 'Tournament' : 'Cash',
      g.name,
      `${chips(g.sb)}/${chips(bb)}${ante}`,
      g.level ? `Level ${g.level}` : '',
      g.kind === 'mtt' && g.stage ? STAGE_EN[g.stage] : '',
      g.playersLeft ? `${g.playersLeft} left` : '',
      `${hand.players.length}-handed`,
    ]
      .filter(Boolean)
      .join(' · '),
  );
  out.push('');
  // Seats in preflop order, as forum posts list them.
  const order = hand.players.map((_, i) => i).sort((a, b) => preflopRank(pos[a]) - preflopRank(pos[b]));
  for (const i of order) out.push(`${pos[i]}${i === hand.hero ? ' (Hero)' : ''}: ${inBB(hand.players[i].stack, bb)}`);
  const hero = hand.players[hand.hero];
  if (hero.cards?.length) out.push('', `Hero is ${pos[hand.hero]} with ${hero.cards.join(' ')}`);

  // One block per street: pot going in, the new card(s), then the actions.
  type Block = { street: Street; pot: number; cards: string[]; acts: string[] };
  const blocks: Block[] = [];
  for (const st of r.steps) {
    if (st.kind === 'start') blocks.push({ street: 'preflop', pot: totalPot(st.state), cards: [], acts: [] });
    else if (st.kind === 'board') {
      const n = st.state.boardCount;
      blocks.push({ street: st.street, pot: totalPot(st.state), cards: st.street === 'flop' ? hand.board.slice(0, 3) : hand.board.slice(n - 1, n), acts: [] });
    } else if (st.kind === 'action' && st.state.last) {
      const s = st.actStreet ?? st.street;
      const b = [...blocks].reverse().find((x) => x.street === s) ?? blocks[blocks.length - 1];
      b?.acts.push(`${who(st.state.last.p)} ${verb(st.state.last, bb)}`);
    }
  }
  for (const b of blocks) {
    out.push('');
    const acts = b.street === 'preflop' ? foldsTo(b.acts) : b.acts;
    const head = `${STREET_EN[b.street]} (${inBB(b.pot, bb)})${b.cards.length ? ': ' + b.cards.join(' ') : ''}`;
    out.push(head);
    if (acts.length) out.push(acts.join(', '));
  }
  if (r.boards.length === 2) out.push('', `Second run: ${r.boards[1].join(' ')}`);

  if (r.result) {
    out.push('');
    if (!r.final.foldWin) {
      for (let i = 0; i < hand.players.length; i++) {
        const c = hand.players[i].cards;
        if (i !== hand.hero && !r.final.folded[i] && c?.length === 2) out.push(`${who(i)} shows ${c.join(' ')}`);
      }
    }
    const winners = r.result.won.map((w, i) => (w > 0 ? `${who(i)} wins ${inBB(w, bb)}` : '')).filter(Boolean);
    if (winners.length) out.push(winners.join(', '));
  }

  if (opts.notes && hand.notes.trim()) out.push('', hand.notes.trim());
  if (opts.link || opts.brand) out.push('');
  if (opts.link) out.push(`Replay: ${opts.link}`);
  if (opts.brand) out.push(`Shared with Sweatbook · ${BRAND_HOST}`);
  return out.join('\n');
}

const BRAND_HOST = 'sweatbook.poker';

const PREFLOP_ORDER = ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
function preflopRank(p: string) {
  const i = PREFLOP_ORDER.indexOf(p);
  return i < 0 ? 99 : i;
}

/** "UTG folds, HJ folds, CO raises…" → "2 folds, CO raises…". */
function foldsTo(acts: string[]): string[] {
  let n = 0;
  while (n < acts.length && acts[n].endsWith(' folds') && !acts[n].startsWith('Hero ')) n++;
  return n >= 2 ? [`${n} folds`, ...acts.slice(n)] : acts;
}
