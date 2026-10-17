import type { ReplayStep } from './replay';
import type { ActionType, Card, HandRecord, Street } from './types';

export type AmountMode = 'chips' | 'bb';

/**
 * Same rules as the app (src/poker/format.ts chips()): plain number under 10k in the page's
 * locale (pt-PT: 1380, 9 500), then 12.5k / 250k / 1.25M.
 */
export function formatChips(n: number, locale: 'pt' | 'en' = 'pt'): string {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a < 10_000) return sign + Math.round(a).toLocaleString(locale === 'pt' ? 'pt-PT' : 'en-US').replace(/\s/g, ' ');
  if (a < 1_000_000) return sign + fixed(a / 1000, a < 100_000 ? 1 : 0) + 'k';
  return sign + fixed(a / 1_000_000, 2) + 'M';
}

function fixed(x: number, digits: number): string {
  return x.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function trim(x: number): string {
  return (Math.round(x * 10) / 10).toString();
}

export function formatAmount(n: number, bb: number, mode: AmountMode = 'chips', locale: 'pt' | 'en' = 'pt'): string {
  if (mode === 'bb') return `${trim(n / bb)} BB`;
  return formatChips(n, locale);
}

const ACTION_LABEL: Record<'pt' | 'en', Record<ActionType, string>> = {
  pt: {
    post_sb: 'SB',
    post_bb: 'BB',
    post_ante: 'Ante',
    post_straddle: 'Straddle',
    fold: 'Fold',
    check: 'Check',
    call: 'Call',
    bet: 'Bet',
    raise: 'Raise',
    allin: 'All-in',
  },
  en: {
    post_sb: 'SB',
    post_bb: 'BB',
    post_ante: 'Ante',
    post_straddle: 'Straddle',
    fold: 'Fold',
    check: 'Check',
    call: 'Call',
    bet: 'Bet',
    raise: 'Raise',
    allin: 'All-in',
  },
};

export function actionLabel(type: ActionType, locale: 'pt' | 'en' = 'pt'): string {
  return ACTION_LABEL[locale][type];
}

const STREET_LABEL: Record<'pt' | 'en', Record<Street, string>> = {
  pt: { preflop: 'Pré-flop', flop: 'Flop', turn: 'Turn', river: 'River' },
  en: { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' },
};

export function streetLabel(street: Street, locale: 'pt' | 'en' = 'pt'): string {
  return STREET_LABEL[locale][street];
}

const SUIT_SYMBOL: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

export function cardText(card: Card): string {
  const rank = card[0] === 'T' ? '10' : card[0];
  return `${rank}${SUIT_SYMBOL[card[1]]}`;
}

/** One line describing a step, e.g. "CO Raise 2,400" or "Flop K♠ 7♦ 2♣". */
export function describeStep(step: ReplayStep, bb: number, mode: AmountMode = 'chips', locale: 'pt' | 'en' = 'pt'): string {
  if (step.kind === 'start') return locale === 'pt' ? 'Início da mão' : 'Hand starts';
  if (step.kind === 'street') {
    const newCards = step.street === 'flop' ? step.board.slice(0, 3) : step.board.slice(-1);
    return `${streetLabel(step.street, locale)} ${newCards.map(cardText).join(' ')}`;
  }
  if (step.kind === 'action' && step.action) {
    const seat = step.seats.find((s) => s.seat === step.action!.seat)!;
    const a = step.action;
    const amount =
      a.type === 'fold' || a.type === 'check'
        ? ''
        : ` ${formatAmount(a.type === 'call' ? a.paid : a.toAmount, bb, mode, locale)}`;
    return `${seat.name} ${actionLabel(a.type, locale)}${amount}`;
  }
  const paid = (winners: NonNullable<ReplayStep['winners']>) =>
    winners
      .map((w) => {
        const s = step.seats.find((x) => x.seat === w.seat)!;
        const verb = locale === 'pt' ? 'ganha' : 'wins';
        return `${s.name} ${verb} ${formatAmount(w.amount, bb, mode, locale)}${w.handLabel ? ` (${w.handLabel})` : ''}`;
      })
      .join(' · ');
  // Run it twice: what each board paid.
  if (step.runs) return step.runs.map((r, k) => `Board ${k + 1}: ${paid(r.winners)}`).join(' · ');
  return paid(step.winners ?? []);
}

/** "1k/2k", plus the ante, button ante or bomb pot: "1/2 · ante BTN 2", "1/2 · bomb pot 5". */
export function stakesText(blinds: HandRecord['blinds'], fmt: (n: number) => string = formatChips, sep = ' · '): string {
  const extra = blinds.bombPot ? `bomb pot ${fmt(blinds.bombPot)}` : blinds.btnAnte ? `ante BTN ${fmt(blinds.btnAnte)}` : blinds.ante ? `ante ${fmt(blinds.ante)}` : '';
  return `${fmt(blinds.sb)}/${fmt(blinds.bb)}${extra ? sep + extra : ''}`;
}

/** Short title for previews: "A♠K♦ vs Q♥Q♣ · 1k/2k". */
export function handTitle(hand: HandRecord): string {
  const hero = hand.players.find((p) => p.isHero);
  const heroCards = hero?.cards?.length ? hero.cards.map(cardText).join('') : '';
  const stakes = `${formatChips(hand.blinds.sb)}/${formatChips(hand.blinds.bb)}${hand.blinds.ante ? ` (${formatChips(hand.blinds.ante)})` : ''}`;
  return [heroCards, stakes].filter(Boolean).join(' · ');
}

export function isValidCard(c: unknown): c is Card {
  return typeof c === 'string' && /^[2-9TJQKA][shdc]$/.test(c);
}
