// The three numbers on the hand poster, all in big blinds: the poster never shows money.

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

const CUR = '(?:[€$£]|R\\$|EUR|USD|GBP|BRL)';
const AMT = `(?:${CUR}\\s*)?\\d[\\d.,]*\\s*[kK]?(?:\\s*${CUR}(?![A-Za-z]))?`;
// One amount or a stakes pair («€1/€2», «2/5 €»); it only counts as money with a currency in it.
const AMOUNTS = new RegExp(`${AMT}(?:\\s*\\/\\s*${AMT})*`, 'g');
const HAS_CUR = new RegExp(CUR);

/** A game name without amounts of money in it: «Domingo €550» → «Domingo», «1/2 €» goes too. */
export function posterTitle(name: string | undefined): string {
  return (name ?? '')
    .replace(AMOUNTS, (m) => (HAS_CUR.test(m) ? ' ' : m))
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s·|,–-]+|[\s·|,–-]+$/g, '')
    .trim();
}
