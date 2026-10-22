// The local notifications that sell Pro by its value, not its price: a recap
// the day after the first live session of the trial (the trial now starts at a
// session and lasts as long as the store product says), a clear notice before
// the first charge, and a nudge back after a few days away. Pure planning here; nudges-sync
// schedules them on the phone.

import { locale, t } from '@/i18n';
import { type DrillState } from '@/poker/drill';
import { needsReview } from '@/poker/review';
import type { Hand } from '@/poker/types';
import { weekStart } from '@/store/streak';

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

/** The week's notice: Sunday at 13:00, before the evening game. */
export const WEEK_DAY = 0;
/** No come-back nudge this close to the week's notice: one of them is enough. */
const WEEK_COMEBACK_GAP = 2 * DAY;

export type NudgeId = 'trial-end' | 'comeback' | 'week' | 'play-arrive' | 'play-log';
/** Notification kind (lib/notify-policy): only the notice before a charge is 'billing', which can't be switched off. */
export const NUDGE_KIND: Record<NudgeId, 'billing' | 'week' | 'tips'> = { 'trial-end': 'billing', comeback: 'tips', week: 'week', 'play-arrive': 'tips', 'play-log': 'tips' };
/**
 * Old ids, still cancelled so a reminder planned by an older version never fires.
 * 'trial-recap' went because notifications never sell Pro (design/notificacoes.md).
 */
export const NUDGE_IDS: (NudgeId | 'trial-day5' | 'trial-recap')[] = ['trial-end', 'comeback', 'week', 'play-arrive', 'play-log', 'trial-day5', 'trial-recap'];

export interface Nudge {
  id: NudgeId;
  at: number;
  title: string;
  body: string;
  /** Opened when tapped; the app's first screen when absent. */
  url?: string;
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
  hands: (Pick<Hand, 'createdAt'> & Partial<Pick<Hand, 'id' | 'sessionId' | 'tags' | 'review' | 'folders'>>)[];
  sessions: { id?: string; startedAt: number; endedAt?: number }[];
  sessionActive: boolean;
  comeback?: ComebackState;
  /** True when a festival is on at that time: no come-back nudge then, the player is away playing. */
  festivalAt?: (ts: number) => boolean;
  /** Weeks in a row with something logged (store/streak), for the week's notice. */
  streakWeeks?: number;
  /** The day the player said they play next, from the session summary («Quando voltas a jogar?»). */
  plan?: PlayPlan | null;
  /** When each hand's «O que fazes aqui?» comes back (poker/drill): due ones count as hands to review. */
  drill?: DrillState;
}

/** «Quando voltas a jogar?»: the start of the day the player picked. */
export interface PlayPlan {
  day: number;
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

/** Sunday 13:00 of the week `now` falls in (weeks start on Monday, as the streak's). */
export function weekNoticeAt(now: number): number {
  const d = new Date(weekStart(now));
  d.setDate(d.getDate() + 6);
  return atHour(d.getTime(), NUDGE_HOUR);
}

const count = (n: number, one: string, many: string) => (n === 1 ? t(one) : t(many, { n }));

/**
 * The week's notice, planned for this Sunday: only for a week with something
 * logged, so it never chases someone who stopped. No amounts, no "won" or
 * "lost": it reaches the lock screen, and it is about the habit, not the result.
 * With hands waiting it opens the review queue (pure, tested).
 */
export function weekNotice(p: Pick<NudgeInput, 'now' | 'hands' | 'sessions' | 'streakWeeks' | 'drill'>): Nudge | null {
  const at = weekNoticeAt(p.now);
  if (at <= p.now + 60_000) return null;
  // The 1st is the month's recap day (lib/month-recap): one notice that day.
  if (new Date(at).getDate() === 1) return null;
  const from = weekStart(p.now);
  const sessions = p.sessions.filter((s) => s.endedAt && s.endedAt >= from && s.endedAt < at).length;
  const hands = p.hands.filter((h) => h.createdAt >= from && h.createdAt < at).length;
  if (!sessions && !hands) return null;
  const drill = p.drill ?? {};
  // Waiting for a first review, or due again by Sunday (a reviewed hand's question comes back).
  const waiting = p.hands.filter((h) => (h.id && drill[h.id] ? drill[h.id].due <= at : needsReview({ ...h, tags: h.tags ?? [] } as Hand))).length;
  const logged = [sessions ? count(sessions, '1 sessão', '{n} sessões') : '', hands ? count(hands, '1 mão', '{n} mãos') : ''].filter(Boolean);
  const week = logged.length === 2 ? t('{a} e {b} esta semana.', { a: logged[0], b: logged[1] }) : t('{a} esta semana.', { a: logged[0] });
  const next = waiting
    ? waiting === 1
      ? t('Tens 1 mão para rever: toca para começar.')
      : t('Tens {n} mãos para rever: toca para começar.', { n: waiting })
    : (p.streakWeeks ?? 0) >= 2
      ? t('{n} semanas seguidas a registar.', { n: p.streakWeeks! })
      : t('Toca para veres as tuas mãos.');
  return { id: 'week', at, title: t('A tua semana no póquer'), body: `${week} ${next}`, url: waiting ? 'sweatbook://train' : 'sweatbook://hands' };
}

/** The same clock time `days` calendar days later (a day is not always 24 h). */
function addDays(ts: number, days: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** The hour the player usually sits down: the median of the last 10 sessions, between 12:00 and 22:00; 19:00 with none. */
export function usualStartHour(sessions: { startedAt: number; endedAt?: number }[]): number {
  const hours = sessions
    .filter((s) => s.endedAt)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 10)
    .map((s) => new Date(s.startedAt).getHours())
    .sort((a, b) => a - b);
  if (!hours.length) return 19;
  return Math.min(22, Math.max(12, hours[Math.floor(hours.length / 2)]));
}

/**
 * The two notices of a play plan, both about logging, never about going to play: on the day, at
 * the usual hour, «Chegaste à mesa?» opens the session; the next day at 13:00, if nothing was
 * logged that day, «Jogaste ontem?» opens a past session. A session started on the day (live or
 * logged after) ends the plan (pure, tested).
 */
export function playNotices(plan: PlayPlan | null | undefined, sessions: { startedAt: number; endedAt?: number }[], now: number): Nudge[] {
  if (!plan) return [];
  const soon = now + 60_000;
  if (sessions.some((s) => s.startedAt >= plan.day)) return [];
  const out: Nudge[] = [];
  const arrive = atHour(plan.day, usualStartHour(sessions));
  if (arrive > soon) {
    out.push({ id: 'play-arrive', at: arrive, title: t('Chegaste à mesa?'), body: t('Abre a sessão com um toque: o jogo e as blinds já vêm preenchidos.'), url: 'sweatbook://session' });
  }
  const log = atHour(addDays(plan.day, 1), NUDGE_HOUR);
  if (log > soon) {
    out.push({ id: 'play-log', at: log, title: t('Jogaste ontem?'), body: t('Regista a sessão em 20 segundos, enquanto te lembras de tudo.'), url: 'sweatbook://bankroll?add=session' });
  }
  return out;
}

export function planNudges(p: NudgeInput): Nudge[] {
  const out: Nudge[] = [];
  const soon = p.now + 60_000;

  if (p.isPro && p.trial && p.trial.end > p.now) {
    const { end } = p.trial;
    const notice = p.trial.willRenew ? chargeNoticeAt(end) : null;
    const date = new Date(end).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
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

  // The week, unless the player is at the table or away at a festival then.
  const week = p.sessionActive ? null : weekNotice(p);
  if (week && !p.festivalAt?.(week.at) && !out.some((n) => Math.abs(n.at - week.at) < 12 * HOUR)) out.push(week);

  // The day the player said they play next: the notices they asked for.
  const play = p.sessionActive ? [] : playNotices(p.plan, p.sessions, p.now);
  out.push(...play);

  // Back after a few days away, only for someone who has logged something to come back to.
  const cb = p.comeback ?? { ignored: 0 };
  if (!p.sessionActive && p.hands.length + p.sessions.length > 0 && cb.ignored < COMEBACK_MAX_IGNORED) {
    const at = atHour(Math.max(p.now + COMEBACK_DAYS * DAY, (cb.last ?? 0) + COMEBACK_GAP_DAYS * DAY), NUDGE_HOUR);
    const near = out.some((n) => Math.abs(n.at - at) < (n.id === 'week' || n.id.startsWith('play-') ? WEEK_COMEBACK_GAP : 12 * HOUR));
    if (!near && !p.festivalAt?.(at)) {
      out.push({ id: 'comeback', at, title: t('Jogaste esta semana?'), body: t('Regista a sessão e a mão que te ficou na cabeça.') });
    }
  }
  return out;
}
