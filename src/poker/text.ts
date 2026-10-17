// Plain-text hand history, for pasting into WhatsApp/Discord or a coach.

import { comboLabel, SUIT_SYMBOL } from './cards';
import { positions, replay } from './engine';
import { amount, blindsLabel } from './format';
import { STAGES, type Hand, type Street, type Suit } from './types';
import { actionLabel, displayName } from './view';

const STREET_PT: Record<Street, string> = { preflop: 'PRÉ-FLOP', flop: 'FLOP', turn: 'TURN', river: 'RIVER' };

function card(c: string) {
  return c[0] + SUIT_SYMBOL[c[1] as Suit];
}

export function handText(hand: Hand, opts: { inBB?: boolean; link?: string } = {}): string {
  const inBB = !!opts.inBB;
  const r = replay(hand);
  const pos = positions(hand.players.length, hand.button);
  const g = hand.game;
  const lines: string[] = [];
  const stage = STAGES.find((s) => s.id === g.stage)?.label;
  lines.push(
    [g.name || (g.kind === 'mtt' ? 'Torneio' : 'Cash'), blindsLabel(hand), g.level ? `Nível ${g.level}` : '', stage ?? '', g.playersLeft ? `${g.playersLeft} restantes` : '']
      .filter(Boolean)
      .join(' · '),
  );
  const hero = hand.players[hand.hero];
  lines.push(`Hero (${pos[hand.hero]}) ${(hero.cards ?? []).map(card).join(' ')}  ${comboLabel(hero.cards)}`.trim());
  lines.push(
    'Stacks: ' +
      hand.players.map((p, i) => `${displayName(hand, i, pos)} ${pos[i] === displayName(hand, i, pos) ? '' : '(' + pos[i] + ') '}${amount(p.stack, hand, inBB)}`).join(', '),
  );
  let street: Street | null = null;
  let cur: string[] = [];
  const flush = () => {
    if (street && cur.length) lines.push(`${STREET_PT[street]}${boardTag(hand, street)}: ${cur.join(', ')}`);
    cur = [];
  };
  for (const st of r.steps) {
    if (st.kind !== 'action' || !st.state.last) continue;
    const s = st.actStreet ?? st.street;
    if (s !== street) {
      flush();
      street = s;
    }
    cur.push(`${displayName(hand, st.state.last.p, pos)} ${actionLabel(st.state.last, hand, inBB).toLowerCase()}`);
  }
  flush();
  if (hand.board.length > 0 && street !== 'river') {
    // Run-out after an all-in.
    lines.push(`BOARD: ${hand.board.map(card).join(' ')}`);
  }
  if (r.result) {
    const shown = hand.players
      .map((p, i) => (i !== hand.hero && !r.final.folded[i] && p.cards?.length === 2 ? `${displayName(hand, i, pos)} mostra ${p.cards.map(card).join(' ')}` : ''))
      .filter(Boolean);
    if (shown.length) lines.push(shown.join(' · '));
    const winners = r.result.won.map((w, i) => (w > 0 ? `${displayName(hand, i, pos)} ganha ${amount(w, hand, inBB)}` : '')).filter(Boolean);
    if (winners.length) lines.push(winners.join(' · '));
  }
  if (hand.tags.length) lines.push('Tags: ' + hand.tags.join(', '));
  if (hand.notes) lines.push('Notas: ' + hand.notes);
  if (opts.link) lines.push('', 'Replay: ' + opts.link);
  return lines.join('\n');
}

function boardTag(hand: Hand, s: Street) {
  if (s === 'preflop') return '';
  const n = s === 'flop' ? 3 : s === 'turn' ? 4 : 5;
  const cards = s === 'flop' ? hand.board.slice(0, 3) : hand.board.slice(n - 1, n);
  return cards.length ? ' [' + cards.map(card).join(' ') + ']' : '';
}
