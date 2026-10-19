// The mental game check-in in one line, for lists: kept apart from MindCheckIn.tsx, which only
// loads when its cards are on screen.

import { t } from '@/i18n';
import type { MindCheck } from '@/store/types';

export const sleepLabel = (h: number) => (h <= 4 ? '≤4 h' : h >= 9 ? '9+ h' : `${h} h`);

/** Short summary for a list row: "7 h · energia 4 · foco 3 · tilt 2". */
export function mindLine(m: MindCheck): string {
  return [
    m.sleep !== undefined ? sleepLabel(m.sleep) : '',
    m.energy ? t('energia {n}', { n: m.energy }) : '',
    m.focus ? t('foco {n}', { n: m.focus }) : '',
    m.mood ? t(m.mood).toLowerCase() : '',
    m.tilt ? t('tilt {n}', { n: m.tilt }) : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
