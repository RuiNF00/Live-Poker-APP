// The three numbers on the hand poster, all in big blinds: the poster never shows money.

import { withoutMoney } from '../../packages/hand-format/src/no-money';
import { t } from '@/i18n';
import { replay } from '@/poker/engine';
import { bbs } from '@/poker/format';
import type { Hand } from '@/poker/types';

import { potInBB } from './session-card';

export interface PosterStat {
  key: 'pot' | 'stack' | 'net';
  label: string;
  value: string;
  tone?: 'good' | 'bad';
}

export function posterStats(hand: Hand): PosterStat[] {
  const bb = hand.game.bb;
  if (!bb) return [];
  let net: number | null = null;
  try {
    const r = replay(hand);
    net = r.result?.resolved ? r.result.net[hand.hero] : null;
  } catch {
    net = null;
  }
  const pot = potInBB(hand);
  const stack = hand.players[hand.hero]?.stack ?? 0;
  const out: PosterStat[] = [];
  if (pot) out.push({ key: 'pot', label: t('Pote'), value: bbs(pot * bb, bb) });
  if (stack) out.push({ key: 'stack', label: 'Stack', value: bbs(stack, bb) });
  if (net) out.push({ key: 'net', label: t('Resultado'), value: (net > 0 ? '+' : '') + bbs(net, bb), tone: net > 0 ? 'good' : 'bad' });
  return out;
}

/** A game name without amounts of money in it: «Domingo €550» → «Domingo» (the same rule as the site's previews). */
export function posterTitle(name: string | undefined): string {
  return withoutMoney(name);
}
