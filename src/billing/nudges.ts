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
/** At most one come-back nudge in this many days, and none after this many in a row went unanswered. */
export const COMEBACK_GAP_DAYS = 14;
export const COMEBACK_MAX_IGNORED = 2;

/** What happened to earlier come-back nudges (kept by nudges-sync). */
export interface ComebackState {
  /** When the last planned one was due. */
  planned?: number;
  /** When the last one actually went off. */
  last?: number;
  /** Ones in a row the player didn't open the app for within 2 days. */
  ignored: number;
}

/** Updates the record on a sync (each sync runs when the app comes to the front) (pure, tested). */
export function comebackSeen(s: ComebackState, now: number): ComebackState {
  if (!s.planned || s.planned > now) return { ...s, planned: undefined };
  // It went off before this open: answered if the player came back within 2 days.
  return { last: s.planned, ignored: now - s.planned <= 2 * DAY ? 0 : s.ignored + 1 };
}

export type NudgeId = 'trial-recap' | 'trial-end' | 'comeback';
/** Android channels: billing ones always go out during a trial; tips are the optional reminders. */
/** Notification kind (lib/notify-policy): only the notice before a charge is 'billing', which can't be switched off. */
export const NUDGE_KIND: Record<NudgeId, 'billing' | 'tips'> = { 'trial-recap': 'tips', 'trial-end': 'billing', comeback: 'tips' };
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
  comeback?: ComebackState;
  /** True when a festival is on at that time: no come-back nudge then, the player is away playing. */
  festivalAt?: (ts: number) => boolean;
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

/** The same notice inside the app, for players without notifications (payments audit §9) (pure, tested). */
export function chargeNoticeDue(trial: Trial | null, now: number, notificationsOn: boolean): boolean {
  return !!trial && trial.willRenew && !notificationsOn && now >= chargeNoticeAt(trial.end) && now < trial.end;
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
  const cb = p.comeback ?? { ignored: 0 };
  if (!p.sessionActive && p.hands.length + p.sessions.length > 0 && cb.ignored < COMEBACK_MAX_IGNORED) {
    const at = atHour(Math.max(p.now + COMEBACK_DAYS * DAY, (cb.last ?? 0) + COMEBACK_GAP_DAYS * DAY), NUDGE_HOUR);
    if (!out.some((n) => Math.abs(n.at - at) < 12 * HOUR) && !p.festivalAt?.(at)) {
      out.push({ id: 'comeback', at, title: t('Jogaste esta semana?'), body: t('Regista a sessão e a mão que te ficou na cabeça.') });
    }
  }
  return out;
}
