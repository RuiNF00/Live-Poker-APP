// What the tournament screen says about one festival event, from the published
// row alone: its other flights and days, when registration closes, the start
// on the phone's clock. Nothing here is guessed: what the organiser didn't publish
// comes back undefined and the screen says so.

import { t } from '@/i18n';
import { venueClock, venueTime, type Festival, type FestivalEvent } from '@/poker/festivals';

/** Every row of the same tournament (its flights and Day 2s), in start order. Just the event when it has one row. */
export function tournamentRows(f: Festival, e: FestivalEvent): FestivalEvent[] {
  // An added tournament has a number of its own (ownEvent), so it never picks up a published one's flights.
  const rows = f.events.filter((x) => x.number === e.number);
  return (rows.length ? rows : [e]).slice().sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}

/** Flights a player can enter (not Day 2s), counted for "1 de 6 flights". */
export function entryFlights(rows: FestivalEvent[]): FestivalEvent[] {
  return rows.filter((x) => !x.day2);
}

/** When registration closes: the player's own time if set, else the organiser's; epoch ms, or undefined. */
export function lateRegClose(f: Festival, e: FestivalEvent, lateMin: number | undefined): number | undefined {
  if (!lateMin) return undefined;
  return venueTime(f, e.start) + lateMin * 60_000;
}

/** "5 h 30" from minutes. */
export function hoursLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? (m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`) : `${m} min`;
}

/** The start on the phone's clock, when the phone's zone differs from the venue's at that instant; else null. */
export function phoneStart(f: Festival, e: FestivalEvent, phoneOffsetMin: (ms: number) => number = (ms) => -new Date(ms).getTimezoneOffset()): { ms: number; otherDay: boolean } | null {
  const ms = venueTime(f, e.start);
  const venueOff = Math.round((venueClock(f, ms).getTime() - ms) / 60_000);
  const phoneOff = phoneOffsetMin(ms);
  if (venueOff === phoneOff) return null;
  const phoneDay = new Date(ms + phoneOff * 60_000).toISOString().slice(0, 10);
  return { ms, otherDay: phoneDay !== e.start.slice(0, 10) };
}

/** "Flight 1A", "Dia 2", "Dia 2 · Flight 2BC"; null for a single-row tournament. */
export function flightLabel(e: FestivalEvent): string | null {
  if (!e.flight) return null;
  if (!e.day2) return `Flight ${e.flight}`;
  return e.flight === '2' ? t('Dia 2') : t('Dia 2 · Flight {f}', { f: e.flight });
}
