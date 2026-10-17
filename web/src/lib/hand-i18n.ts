import {
  actionLabel as hfActionLabel,
  buildReplay as hfBuildReplay,
  cardText,
  type ActionType,
  type AmountMode,
  type BuildOptions,
  type HandRecord,
  type ReplayStep,
  type Street,
} from '@livepoker/hand-format';
import { numberTag, type Locale } from './i18n';

// The shared hand-format package speaks pt-PT and English only. These wrappers give the site's
// four locales the same functions: pt-PT goes straight through, the others get their own labels
// and number formatting here (the package is shared with the app and stays as it is).

type HfLocale = 'pt' | 'en';
const hf = (l: Locale): HfLocale => (l === 'pt' || l === 'pt-BR' ? 'pt' : 'en');

const STREET: Record<Locale, Record<Street, string>> = {
  pt: { preflop: 'Pré-flop', flop: 'Flop', turn: 'Turn', river: 'River' },
  'pt-BR': { preflop: 'Pré-flop', flop: 'Flop', turn: 'Turn', river: 'River' },
  en: { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' },
  es: { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' },
};

const START: Record<Locale, string> = { pt: 'Início da mão', 'pt-BR': 'Início da mão', en: 'Hand starts', es: 'Inicio de la mano' };
const WINS: Record<Locale, string> = { pt: 'ganha', 'pt-BR': 'ganha', en: 'wins', es: 'gana' };

/** Hand names the package writes (pt-PT or English) in the other two locales. */
const CATEGORY: Partial<Record<Locale, Record<string, string>>> = {
  'pt-BR': {
    Trio: 'Trinca',
    Cor: 'Flush',
    Poker: 'Quadra',
    'Sequência de cor': 'Straight flush',
  },
  es: {
    'High card': 'Carta alta',
    Pair: 'Pareja',
    'Two pair': 'Doble pareja',
    'Three of a kind': 'Trío',
    Straight: 'Escalera',
    Flush: 'Color',
    'Full house': 'Full',
    'Four of a kind': 'Póker',
    'Straight flush': 'Escalera de color',
  },
};

const relabel = (l: Locale, label: string | undefined) => (label === undefined ? label : CATEGORY[l]?.[label] ?? label);

export function streetLabel(street: Street, l: Locale): string {
  return STREET[l][street];
}

export function actionLabel(type: ActionType, l: Locale): string {
  return hfActionLabel(type, hf(l));
}

export function buildReplay(hand: HandRecord, opts: Omit<BuildOptions, 'locale'> & { locale: Locale }): ReplayStep[] {
  const steps = hfBuildReplay(hand, { ...opts, locale: hf(opts.locale) });
  if (!CATEGORY[opts.locale]) return steps;
  const l = opts.locale;
  const win = (w: { seat: number; amount: number; handLabel?: string }) => ({ ...w, handLabel: relabel(l, w.handLabel) });
  return steps.map((s) => ({
    ...s,
    seats: s.seats.map((x) => ({ ...x, handLabel: relabel(l, x.handLabel) })),
    winners: s.winners?.map(win),
    runs: s.runs?.map((r) => ({ ...r, winners: r.winners.map(win) })),
  }));
}

/** Same rules as the package (plain number under 10k, then 12.5k / 250k / 1.25M), in the page's locale. */
export function formatChips(n: number, l: Locale): string {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a < 10_000) return sign + Math.round(a).toLocaleString(l === 'pt' ? 'pt-PT' : l === 'en' ? 'en-US' : numberTag(l)).replace(/\s/g, ' ');
  if (a < 1_000_000) return sign + fixed(a / 1000, a < 100_000 ? 1 : 0) + 'k';
  return sign + fixed(a / 1_000_000, 2) + 'M';
}

function fixed(x: number, digits: number): string {
  return x.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

export function formatAmount(n: number, bb: number, mode: AmountMode, l: Locale): string {
  if (mode === 'bb') return `${(Math.round((n / bb) * 10) / 10).toString()} BB`;
  return formatChips(n, l);
}

/** One line describing a step, e.g. "CO Raise 2,400" or "Flop K♠ 7♦ 2♣". */
export function describeStep(step: ReplayStep, bb: number, mode: AmountMode, l: Locale): string {
  if (step.kind === 'start') return START[l];
  if (step.kind === 'street') {
    const newCards = step.street === 'flop' ? step.board.slice(0, 3) : step.board.slice(-1);
    return `${streetLabel(step.street, l)} ${newCards.map(cardText).join(' ')}`;
  }
  if (step.kind === 'action' && step.action) {
    const seat = step.seats.find((s) => s.seat === step.action!.seat)!;
    const a = step.action;
    const amount = a.type === 'fold' || a.type === 'check' ? '' : ` ${formatAmount(a.type === 'call' ? a.paid : a.toAmount, bb, mode, l)}`;
    return `${seat.name} ${actionLabel(a.type, l)}${amount}`;
  }
  const paid = (winners: NonNullable<ReplayStep['winners']>) =>
    winners
      .map((w) => {
        const s = step.seats.find((x) => x.seat === w.seat)!;
        return `${s.name} ${WINS[l]} ${formatAmount(w.amount, bb, mode, l)}${w.handLabel ? ` (${w.handLabel})` : ''}`;
      })
      .join(' · ');
  if (step.runs) return step.runs.map((r, k) => `Board ${k + 1}: ${paid(r.winners)}`).join(' · ');
  return paid(step.winners ?? []);
}
