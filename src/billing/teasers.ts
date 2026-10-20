// What Pro would tell this player, said without the answer: "Numa das salas, o
// teu resultado é negativo", not which one or how much. Never "where you win
// more": a teaser describes the player's record, it doesn't point them at a table. Every line comes from an
// insight the app really found in their sessions (insights-math.ts, same
// sample rules), so nothing is promised that the Pro screen doesn't show.
// The free screens stay as they are; this only names what's behind the lock.

import { insights, type Insight } from '@/store/insights-math';
import type { Session } from '@/store/types';

export interface Teaser {
  /** The insight it hides, so a moment can be dismissed for good. */
  id: Insight['id'];
  tone: Insight['tone'];
  /** Portuguese key; show with t(). No names, no amounts. */
  text: string;
}

/** The finding, without what it found. */
export function teaserText(x: Pick<Insight, 'id' | 'tone' | 'groups'>): string {
  const loses = x.groups.some((g) => g.rate < 0);
  switch (x.id) {
    case 'venue':
      return loses ? 'Numa das salas, o teu resultado é negativo.' : 'O teu resultado muda muito de sala para sala.';
    case 'stakes':
      return loses ? 'Numa das stakes, o teu resultado é negativo.' : 'O teu resultado muda muito de stake para stake.';
    case 'weekday':
      return loses ? 'Num dos dias da semana, o teu resultado é negativo.' : 'O teu resultado muda muito com o dia da semana.';
    case 'daytime':
      return 'A hora a que começas a sessão mexe no teu resultado.';
    case 'length':
      return 'A partir de certa hora de sessão, o teu resultado muda.';
    case 'tilt':
    case 'tiltNext':
      return 'A sessão a seguir a uma má mexe no teu resultado.';
    case 'sleep':
      return 'As horas que dormes mexem no teu resultado.';
    case 'energy':
      return 'A tua energia antes de jogar mexe no teu resultado.';
    case 'focus':
      return 'O teu foco antes de jogar mexe no teu resultado.';
  }
}

/** Findings in the player's finished sessions in one currency, strongest first; the money formatter is never shown here. */
export function teasers(sessions: Session[], currency: string): Teaser[] {
  const list = sessions.filter((s) => s.endedAt && s.currency === currency);
  return insights(list, () => '').map((x) => ({ id: x.id, tone: x.tone, text: teaserText(x) }));
}
