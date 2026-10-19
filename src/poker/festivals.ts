// Festival types and the clock helpers every screen uses. The schedules
// themselves are in festival-data.ts, loaded lazily (see my-festivals.ts).

export interface FestivalEvent {
  /** Stable across app versions: plans and sessions point at it. */
  id: string;
  number: number;
  name: string;
  /** Flight letter as published ("A", "2A"...), when the event has several. */
  flight?: string;
  /** A Day 2 restart: no new buy-in. */
  day2?: boolean;
  /** The organiser doesn't number its events: `number` only groups flights and days, never shown. */
  unnumbered?: boolean;
  game: 'NLH' | 'PLO' | 'Mix';
  /** Total buy-in, fee included, in the festival currency. 0 for a Day 2. */
  buyIn: number;
  guarantee: number;
  /** Local wall-clock start at the venue, 'YYYY-MM-DDTHH:MM'. */
  start: string;
  /** Added by the player (see FestivalPlan.events). */
  own?: boolean;
  /** Starting stack and level length as published; left out when the organiser hasn't (a session then starts with the defaults). */
  stack?: number;
  levelMinutes?: number;
  /** A Day 2 that takes only some flights: their letters ("ACD"). Without it, the letters after the "2" in `flight`. */
  takes?: string;
  /** Registration closes this many minutes after the start, when the organiser publishes it. */
  lateRegMin?: number;
}

export interface Festival {
  id: string;
  name: string;
  venue: string;
  city: string;
  currency: string;
  /** Venue offset from UTC on the festival dates, in minutes (Nassau in December: EST, -300). */
  utcOffset: number;
  /** The venue's time zone ('Europe/Dublin'): wins over utcOffset, so a summer-time change inside the festival is right. */
  tz?: string;
  /** No link in the app: organisers' sites also run real-money gaming (App Review). The URL stays in a comment by the data. */
  source: { label: string; checked: string };
  /** What the organiser hasn't published, shown under the schedule. */
  notes: string[];
  events: FestivalEvent[];
  /** Official dates, 'YYYY-MM-DD', for a festival whose event schedule isn't out yet (no events). */
  dates?: { from: string; to: string };
  /** 'YYYY-MM' it usually runs in, for a festival with no dates out yet: only orders the list, never shown as dates. */
  month?: string;
  /** Added by the player ("Adicionar o meu festival"): their own name, no source, kept on the phone. */
  own?: boolean;
  /** An own festival's last save: a later delete on another phone drops it, a later edit keeps it (deleted-math.ts). */
  updatedAt?: number;
}

const zoneFmt = new Map<string, Intl.DateTimeFormat>();

/** Minutes the venue is ahead of UTC at `ms`: its time zone's rule when known, else the fixed offset. */
export function offsetAt(f: Pick<Festival, 'utcOffset' | 'tz'>, ms: number): number {
  if (!f.tz) return f.utcOffset;
  try {
    let fmt = zoneFmt.get(f.tz);
    if (!fmt) zoneFmt.set(f.tz, (fmt = new Intl.DateTimeFormat('en-US', { timeZone: f.tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })));
    const p: Record<string, string> = {};
    for (const x of fmt.formatToParts(new Date(ms))) p[x.type] = x.value;
    const wall = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute));
    const off = Math.round((wall - Math.floor(ms / 60_000) * 60_000) / 60_000);
    // An engine without time zones gives the phone's own or nonsense: keep the fixed offset then.
    if (Number.isFinite(off) && Math.abs(off - f.utcOffset) <= 120) return off;
  } catch {}
  return f.utcOffset;
}

/** Epoch ms of a local venue time ('YYYY-MM-DDTHH:MM'). */
export function venueTime(f: Pick<Festival, 'utcOffset' | 'tz'>, local: string): number {
  const [d, hm] = local.split('T');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi] = hm.split(':').map(Number);
  const wall = Date.UTC(y, mo - 1, da, h, mi);
  // The offset at that instant, found from a first guess (twice covers the hour around a change).
  const first = wall - offsetAt(f, wall - f.utcOffset * 60_000) * 60_000;
  return wall - offsetAt(f, first) * 60_000;
}

/** Venue wall-clock date and time of an instant, as a UTC Date to read with getUTC*. */
export function venueClock(f: Pick<Festival, 'utcOffset' | 'tz'>, ms: number): Date {
  return new Date(ms + offsetAt(f, ms) * 60_000);
}

/** "Event #12 · Flight A" style label. */
export function eventTitle(e: FestivalEvent): string {
  return e.unnumbered ? e.name : `#${e.number} ${e.name}`;
}

/** First and last day, 'YYYY-MM-DD': the schedule and the official dates together; null when neither is out. */
export function festivalSpan(f: Festival): { from: string; to: string } | null {
  if (f.events.length) {
    // Official dates widen it: a final day can have no row of its own.
    const days = [...f.events.map(eventDay), ...(f.dates ? [f.dates.from, f.dates.to] : [])].sort();
    return { from: days[0], to: days[days.length - 1] };
  }
  return f.dates ?? null;
}

/** Sorts festivals by when they start; a month-only one sits mid-month. */
export function festivalSortKey(f: Festival): string {
  return festivalSpan(f)?.from ?? (f.month ? `${f.month}-15` : '9999');
}

/** Local day key 'YYYY-MM-DD', for grouping. */
export function eventDay(e: FestivalEvent): string {
  return e.start.slice(0, 10);
}
