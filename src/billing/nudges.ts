// The local notifications that sell Pro by its value, not its price: a recap
// the day after the first live session of the trial (the trial now starts at a
// session and lasts as long as the store product says), a clear notice before
// the first charge, and a nudge back after a few days away. Pure planning here; nudges-sync
// schedules them on the phone.

import { locale, t } from '@/i18n';

const DAY = 86_400_000;
const HOUR = 3_600_000;
/** Midday: before the player heads to the card room, not while at the table. */
const NUDGE_HOUR = 13;
/** Days without opening the app before the come-back nudge. */
export const COMEBACK_DAYS = 4;

export type NudgeId = 'trial-recap' | 'trial-end' | 'comeback';
/** 'trial-day5' is the old id, still cancelled so a reminder planned by an older version never fires. */
export const NUDGE_IDS: (NudgeId | 'trial-day5')[] = ['trial-recap', 'trial-end', 'comeback', 'trial-day5'];

export interface Nudge {
  id: NudgeId;
  at: number;
  title: string;
  body: string;
}

export interface Trial {
  start: number;
  end: number;
  /** False once the player cancelled: no charge is coming, so no charge notice. */
  willRenew: boolean;
}

export interface NudgeInput {
  now: number;
  isPro: boolean;
  trial: Trial | null;
  /** Annual price as the store shows it, for the charge notice. */
  annualPrice: string;
  store: string;
  hands: { createdAt: number; sessionId?: string }[];
  sessions: { id?: string; startedAt: number; endedAt?: number }[];
  sessionActive: boolean;
}

/** `hour`:00 local time on the calendar day of `ts`. */
export function atHour(ts: number, hour: number): number {
  const d = new Date(ts);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

/**
 * When to warn before the trial turns into a charge. Cancelling counts only
 * up to 24 h before the end, so aim at 48 h before, moved into waking hours
 * on that same day: it always lands more than 24 h before the end.
 */
export function chargeNoticeAt(end: number): number {
  const at = end - 2 * DAY;
  const h = new Date(at).getHours();
  if (h < 9) return atHour(at, 10);
  if (h >= 22) return atHour(at, 20);
  return at;
}

function count(n: number, one: string, many: string) {
  return n === 1 ? t(one) : t(many, { n });
}

/** Midday after the session, at least 8 h after it ended (late-night sessions get the next day). */
export function recapAt(endedAt: number): number {
  const at = atHour(endedAt, NUDGE_HOUR);
  return at >= endedAt + 8 * HOUR ? at : atHour(endedAt + DAY, NUDGE_HOUR);
}

export function planNudges(p: NudgeInput): Nudge[] {
  const out: Nudge[] = [];
  const soon = p.now + 60_000;

  if (p.isPro && p.trial && p.trial.end > p.now) {
    const { start, end } = p.trial;
    const notice = p.trial.willRenew ? chargeNoticeAt(end) : null;
    const date = new Date(end).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
    // The day after the first live session that ended during the trial: what Pro kept from it.
    const first = p.sessions.filter((s) => s.endedAt && s.endedAt >= start && s.endedAt < end).sort((a, b) => a.endedAt! - b.endedAt!)[0];
    if (first) {
      const at = recapAt(first.endedAt!);
      const hands = p.hands.filter((h) => (first.id && h.sessionId ? h.sessionId === first.id : h.createdAt >= first.startedAt && h.createdAt <= first.endedAt!)).length;
      if (at > soon && at < end - DAY && (notice === null || Math.abs(at - notice) >= 6 * HOUR)) {
        out.push({
          id: 'trial-recap',
          at,
          title: t('O que o Pro guardou da tua sessão'),
          body: hands > 0 ? t('{hands}, sem limite. Grátis até {date}.', { hands: count(hands, '1 mão', '{n} mãos'), date }) : t('Vê em que sala e stake ganhas mais. Grátis até {date}.', { date }),
        });
      }
    }
    if (notice !== null && notice > soon) {
      out.push({
        id: 'trial-end',
        at: notice,
        title: t('O teste grátis acaba a {date}', { date }),
        body:
          p.store === 'Google Play'
            ? t('Depois, {price} por ano. Para não pagar, cancela na Google Play antes dessa data.', { price: p.annualPrice })
            : t('Depois, {price} por ano. Para não pagar, cancela na {store} até 24 h antes.', { price: p.annualPrice, store: p.store }),
      });
    }
  }

  // Back after a few days away, only for someone who has logged something to come back to.
  if (!p.sessionActive && p.hands.length + p.sessions.length > 0) {
    const at = atHour(p.now + COMEBACK_DAYS * DAY, NUDGE_HOUR);
    if (!out.some((n) => Math.abs(n.at - at) < 12 * HOUR)) {
      out.push({ id: 'comeback', at, title: t('Jogaste esta semana?'), body: t('Regista a sessão e a mão que te ficou na cabeça.') });
    }
  }
  return out;
}
