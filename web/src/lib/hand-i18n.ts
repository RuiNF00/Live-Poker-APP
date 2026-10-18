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
import { numberFormat, numberTag, type Locale } from './i18n';

// The shared hand-format package writes street and action words in pt-PT and English only. These
// wrappers give the site's four locales the same functions, with their own labels and number
// formatting (the package is shared with the app). Hand names come from the package in all four.

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
const BOARD: Record<Locale, string> = { pt: 'Mesa', 'pt-BR': 'Mesa', en: 'Board', es: 'Mesa' };

export function streetLabel(street: Street, l: Locale): string {
  return STREET[l][street];
}

export function actionLabel(type: ActionType, l: Locale): string {
  return hfActionLabel(type, hf(l));
}

export function buildReplay(hand: HandRecord, opts: Omit<BuildOptions, 'locale'> & { locale: Locale }): ReplayStep[] {
  // The package names made hands in all four languages ("Par de Ases", "Pareja de Ases").
  return hfBuildReplay(hand, opts);
}

/** Same rules as the app (plain number under 10k, then 12,5k / 250k / 1,25M), in the page's locale. */
export function formatChips(n: number, l: Locale): string {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  // Cent games (0.25/0.50): a chop of 1.25 pays 0.63 and 0.62, not "1" and "1".
  if (a < 10_000)
    return sign + (Math.abs(a - Math.round(a)) > 1e-9 ? a.toLocaleString(numberTag(l), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(a).toLocaleString(numberTag(l))).replace(/\s/g, ' ');
  if (a < 1_000_000) return sign + fixed(a / 1000, a < 100_000 ? 1 : 0, l) + 'k';
  return sign + fixed(a / 1_000_000, 2, l) + 'M';
}

/** Trailing zeros dropped; a decimal comma where the language writes one, as in the app. */
function fixed(x: number, digits: number, l: Locale): string {
  const s = x.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  return numberFormat(l).decimalComma ? s.replace('.', ',') : s;
}

export function formatAmount(n: number, bb: number, mode: AmountMode, l: Locale): string {
  if (mode === 'bb') return `${fixed(n / bb, 1, l)} BB`;
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
  // No winner picked and a hand unknown: the pot is unresolved, so say only "Showdown", like the app.
  if (step.runs) {
    const runs = step.runs.map((r, k) => (r.winners.length ? `${BOARD[l]} ${k + 1}: ${paid(r.winners)}` : '')).filter(Boolean);
    return runs.length ? runs.join(' · ') : 'Showdown';
  }
  return step.winners?.length ? paid(step.winners) : 'Showdown';
}
