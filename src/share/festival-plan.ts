// "Partilhar o meu plano": the events a player marked at a festival, by day,
// for friends going too. Days, times and event names only; buy-ins only when
// the player turns them on, never a total or the bankroll.

import { locale, t } from '@/i18n';
import { eventDay, eventTitle, venueTime, type Festival, type FestivalEvent } from '@/poker/festivals';
import { money } from '@/poker/format';
import { festivalName, planned, type FestivalPlan } from '@/store/festival-plan';

export interface PlanRow {
  id: string;
  time: string;
  title: string;
  /** "Flight 1A", "Dia 2"; empty for a one-flight event. */
  flight: string;
  buyIn: string;
}

export interface PlanDay {
  day: string;
  label: string;
  rows: PlanRow[];
}

function flightLabel(e: FestivalEvent): string {
  if (!e.flight) return '';
  if (e.day2) return e.flight === '2' ? t('Dia 2') : t('Dia 2 · Flight {f}', { f: e.flight });
  return `Flight ${e.flight}`;
}

/** "sex., 27 nov." style short day, in the app's language. */
export function shortDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** The planned events, by day, in start order. */
export function planDays(f: Festival, plan: FestivalPlan): PlanDay[] {
  const list = planned(f, plan).sort((a, b) => venueTime(f, a.start) - venueTime(f, b.start));
  const out: PlanDay[] = [];
  for (const e of list) {
    const day = eventDay(e);
    let d = out.at(-1);
    if (!d || d.day !== day) out.push((d = { day, label: shortDay(day), rows: [] }));
    d.rows.push({ id: e.id, time: e.start.slice(11, 16), title: eventTitle(e), flight: flightLabel(e), buyIn: e.day2 || !e.buyIn ? '' : money(e.buyIn, f.currency) });
  }
  return out;
}

/** The WhatsApp text: festival, then each day with its times and events, then the link. */
export function planText(f: Festival, plan: FestivalPlan, link: string, opts: { buyIns?: boolean } = {}): string {
  const lines = [t('O meu plano: {name}', { name: festivalName(f, plan) })];
  for (const d of planDays(f, plan)) {
    lines.push('', d.label);
    for (const r of d.rows) lines.push([r.time, r.title, r.flight, opts.buyIns ? r.buyIn : ''].filter(Boolean).join(' · '));
  }
  lines.push('', t('Feito com Sweatbook: {link}', { link }));
  return lines.join('\n');
}

/** Lines that fit on the story between the title and the footer; the rest is "+N". */
const MAX_LINES = 15;

/** The story's day headers and rows, cut to what fits; how many events didn't. */
export function fitPlan(days: PlanDay[], max = MAX_LINES): { days: PlanDay[]; more: number } {
  const out: PlanDay[] = [];
  let used = 0;
  let more = 0;
  for (const d of days) {
    // A day header with no room for at least one row under it goes too.
    const room = max - used - 1;
    if (room < 1) {
      more += d.rows.length;
      continue;
    }
    const rows = d.rows.slice(0, room);
    more += d.rows.length - rows.length;
    out.push({ ...d, rows });
    used += 1 + rows.length;
  }
  return { days: out, more };
}
