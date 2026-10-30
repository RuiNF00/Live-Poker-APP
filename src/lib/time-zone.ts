// The phone's time zone, kept on a session when it is first saved, so a night in Las
// Vegas counts in Las Vegas's calendar wherever the phone is later. Pure apart from
// reading the phone's zone, so it can be tested.

const fmts = new Map<string, Intl.DateTimeFormat>();
/** The phone's zone, read again when the phone's offset changes (it travelled with the app open). */
let here: { zone: string; offset: number } | undefined;
function currentZone(): string {
  const offset = new Date().getTimezoneOffset();
  if (!here || here.offset !== offset) here = { zone: phoneZone() ?? '', offset };
  return here.zone;
}

/** The phone's IANA time zone, or undefined when the engine doesn't say. */
export function phoneZone(): string | undefined {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof z === 'string' && z.length <= 64 && z.includes('/') ? z : undefined;
  } catch {
    return undefined;
  }
}

/** Minutes `tz` is ahead of UTC at `ms`; null when the engine can't tell. */
export function zoneOffset(tz: string, ms: number): number | null {
  try {
    let fmt = fmts.get(tz);
    if (!fmt) fmts.set(tz, (fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })));
    const p: Record<string, string> = {};
    for (const x of fmt.formatToParts(new Date(ms))) p[x.type] = x.value;
    const wall = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute));
    const off = Math.round((wall - Math.floor(ms / 60_000) * 60_000) / 60_000);
    return Number.isFinite(off) && Math.abs(off) <= 14 * 60 ? off : null;
  } catch {
    return null;
  }
}

/**
 * The instant whose date on this phone is the date where it was played: `ms` moved by the
 * difference between that zone and the phone's. Unchanged without a zone, or when the engine
 * can't tell. Use it to put a session in a day, month or year, never to show a time.
 */
export function playedClock(ms: number, tz: string | undefined): number {
  // Most sessions were played where the phone is now: nothing to move, and no Intl call per session.
  if (!tz || tz === currentZone()) return ms;
  const there = zoneOffset(tz, ms);
  if (there === null) return ms;
  return ms + (there + new Date(ms).getTimezoneOffset()) * 60_000;
}

/**
 * The zone a saved session keeps: its own, else the one it already had, else, only when it is new, the phone's.
 * An edit somewhere else keeps the zone it was played in, and an older or imported session without one doesn't
 * take the zone of whoever edits it now.
 */
export function zoneToKeep(s: { tz?: string }, prev: { tz?: string } | undefined, phone: string | undefined): string | undefined {
  return s.tz ?? prev?.tz ?? (prev ? undefined : phone);
}
