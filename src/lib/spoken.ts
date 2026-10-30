// What VoiceOver and TalkBack say where the screen alone reads badly.

import { t } from '@/i18n';

/**
 * What VoiceOver and TalkBack say when a hand or a session has just been saved: the screen
 * changes under the player, and the new one alone doesn't say that it worked, or how it went.
 */
export function savedMessage(what: 'hand' | 'session', result?: string): string {
  const saved = what === 'hand' ? t('Mão guardada') : t('Sessão guardada');
  return result ? `${saved}. ${t('Resultado')}: ${result}` : saved;
}

/** Time played as a screen reader says it: «1 h 05 min», not «1:05:32» read digit by digit. */
export function spokenPlayed(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60000));
  return m >= 60 ? t('{h} h {m} min', { h: Math.floor(m / 60), m: String(m % 60).padStart(2, '0') }) : t('{m} min', { m });
}
