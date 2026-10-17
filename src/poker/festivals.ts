// Published festival schedules the player can plan from. Each one is copied
// from the organiser's own page (see `source`) and checked by hand: buy-ins
// include the fee, times are local to the venue. When a schedule changes,
// update the rows and `source.checked` together.

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
}

export interface Festival {
  id: string;
  name: string;
  venue: string;
  city: string;
  currency: string;
  /** Venue offset from UTC on the festival dates, in minutes (Nassau in December: EST, -300). */
  utcOffset: number;
  /** No link in the app: organisers' sites also run real-money gaming (App Review). The URL stays in a comment by the data. */
  source: { label: string; checked: string };
  /** What the organiser hasn't published, shown under the schedule. */
  notes: string[];
  events: FestivalEvent[];
}

const ev = (number: number, name: string, game: FestivalEvent['game'], buyIn: number, guarantee: number, start: string, flight?: string): FestivalEvent => {
  const day2 = !!flight && flight.startsWith('2');
  return { id: `${number}${flight ? '-' + flight : ''}`, number, name, flight, day2: day2 || undefined, game, buyIn: day2 ? 0 : buyIn, guarantee, start };
};

/**
 * The Baha Mar festival, Nassau, 2–17 December 2026. Shipped under a generic
 * name (no event brand in the app, App Review 5.2.1); the player can rename it.
 * Source: wsop.com/tournaments/2026-wsop-paradise (event list with flights and
 * start times) and wsop.com/news/2026-wsop-paradise (bracelet schedule, same
 * buy-ins), both read on 2026-10-17. Press reports quoted $2,500/$25,000 for
 * some events; the official pages say $2,750/$26,000 and those are used here.
 */
export const BAHAMAS_DEC_2026: Festival = {
  id: 'bahamas-dez-2026',
  name: 'Bahamas, dezembro 2026',
  venue: 'Nassau',
  city: 'Bahamas',
  currency: '$',
  utcOffset: -300,
  // https://www.wsop.com/tournaments/2026-wsop-paradise/
  source: { label: 'calendário oficial do organizador', checked: '2026-10-17' },
  notes: [
    'Horas locais de Nassau (hora de Nova Iorque).',
    'O organizador ainda não publicou o fecho do late reg nem as regras de re-entry: confirma no balcão do torneio.',
    'Flights 2A e 2BC do Main Event tratados como Dia 2 (sem novo buy-in).',
  ],
  events: [
    ev(1, 'NLH Mystery Bounty', 'NLH', 2750, 5_000_000, '2026-12-02T11:00', 'A'),
    ev(1, 'NLH Mystery Bounty', 'NLH', 2750, 5_000_000, '2026-12-02T17:00', 'B'),
    ev(1, 'NLH Mystery Bounty', 'NLH', 2750, 5_000_000, '2026-12-03T11:00', 'C'),
    ev(2, 'High Roller PLO/NLH Mixed', 'Mix', 26000, 1_000_000, '2026-12-03T12:00'),
    ev(1, 'NLH Mystery Bounty', 'NLH', 2750, 5_000_000, '2026-12-03T17:00', 'D'),
    ev(3, 'High Roller NLH', 'NLH', 50000, 2_500_000, '2026-12-04T14:00'),
    ev(4, 'Championship', 'NLH', 10000, 20_000_000, '2026-12-05T11:00', 'A'),
    ev(5, 'Pro-Am', 'NLH', 250000, 10_000_000, '2026-12-05T12:00'),
    ev(6, "Big Bet Mix (Dealer's Choice)", 'Mix', 5300, 1_000_000, '2026-12-05T16:00'),
    ev(4, 'Championship', 'NLH', 10000, 20_000_000, '2026-12-06T11:00', 'B'),
    ev(7, 'PLO High Roller', 'PLO', 50000, 2_000_000, '2026-12-06T14:00'),
    ev(4, 'Championship', 'NLH', 10000, 20_000_000, '2026-12-07T11:00', 'C'),
    ev(8, 'PLO Super High Roller', 'PLO', 100000, 5_000_000, '2026-12-08T12:00'),
    ev(9, 'NLH Deepstack', 'NLH', 5300, 1_000_000, '2026-12-08T14:00'),
    ev(10, '8-Game Mixed', 'Mix', 10000, 1_000_000, '2026-12-09T11:00'),
    ev(11, 'NLH Super High Roller', 'NLH', 100000, 10_000_000, '2026-12-09T12:00'),
    ev(12, 'Main Event', 'NLH', 26000, 50_000_000, '2026-12-10T11:00', 'A'),
    ev(13, '9-Game Mixed Championship', 'Mix', 26000, 2_000_000, '2026-12-10T12:00'),
    ev(12, 'Main Event', 'NLH', 26000, 50_000_000, '2026-12-11T12:00', '2A'),
    ev(14, 'Double Board Bomb Pot PLO', 'PLO', 2750, 1_000_000, '2026-12-12T11:00'),
    ev(12, 'Main Event', 'NLH', 26000, 50_000_000, '2026-12-12T11:00', 'B'),
    ev(12, 'Main Event', 'NLH', 26000, 50_000_000, '2026-12-13T11:00', 'C'),
    ev(12, 'Main Event', 'NLH', 26000, 50_000_000, '2026-12-14T12:00', '2BC'),
    ev(15, 'NLH Mega Stack', 'NLH', 10000, 2_000_000, '2026-12-14T17:00'),
    ev(16, 'NLH High Roller Turbo', 'NLH', 26000, 2_500_000, '2026-12-15T14:00'),
    ev(17, 'PLO Mega Stack', 'PLO', 10000, 1_000_000, '2026-12-15T16:00'),
    ev(19, 'The Closer', 'NLH', 5300, 1_000_000, '2026-12-16T11:00', 'A'),
    ev(18, 'High Roller Turbo PLO', 'PLO', 26000, 1_000_000, '2026-12-16T14:00'),
    ev(19, 'The Closer', 'NLH', 5300, 1_000_000, '2026-12-16T17:00', 'B'),
    ev(20, 'Last Chance', 'NLH', 15000, 1_000_000, '2026-12-17T12:00'),
  ],
};

/** Same as ev(), for schedules without event numbers. A Day 2 row is flight '2'. */
const lv = (...a: Parameters<typeof ev>): FestivalEvent => ({ ...ev(...a), unnumbered: true });

/**
 * The Wynn Las Vegas festival, 27 Nov – 21 Dec 2026, events of $1,000 and up
 * (no satellites). Source: the organiser's schedule page, read on 2026-10-17
 * (two separate reads, same rows); the same schedule is linked as a PDF from
 * wynnlasvegas.com. Shipped under a generic name (App Review 5.2.1). The
 * schedule has no event numbers: `number` here only ties flights and Day 2s
 * of one tournament together. Day 3+ and final tables aren't rows: a bagged
 * tournament carries on from the Sessão tab.
 */
export const LAS_VEGAS_DEC_2026: Festival = {
  id: 'las-vegas-dez-2026',
  name: 'Las Vegas, dezembro 2026',
  venue: 'Las Vegas',
  city: 'EUA',
  currency: '$',
  utcOffset: -480,
  // https://www.worldpokertour.com/event/main-tour-wpt-world-championship-at-wynn-las-vegas-season-2026/schedule
  source: { label: 'calendário oficial do organizador', checked: '2026-10-17' },
  notes: [
    'Horas locais de Las Vegas.',
    'O organizador não publicou o fecho do late reg (no Main Event as inscrições ficam abertas até ao Dia 2): confirma no balcão do torneio.',
    'O Main Event não tem garantia publicada (o prémio adicionado não se aplica no Nevada).',
    'Só eventos de $1,000 ou mais; sem satélites.',
  ],
  events: [
    lv(1, 'PLO', 'PLO', 1100, 0, '2026-12-01T13:00'),
    lv(2, "No Limit Hold'em", 'NLH', 1600, 1_000_000, '2026-12-03T11:00', '1A'),
    lv(2, "No Limit Hold'em", 'NLH', 1600, 1_000_000, '2026-12-04T11:00', '1B'),
    lv(3, 'NLH Championship', 'NLH', 1100, 5_000_000, '2026-12-05T11:00', '1A'),
    lv(3, 'NLH Championship', 'NLH', 1100, 5_000_000, '2026-12-06T11:00', '1B'),
    lv(4, 'PLO Mystery Bounty', 'PLO', 1600, 500_000, '2026-12-06T11:00', '1A'),
    lv(4, 'PLO Mystery Bounty', 'PLO', 1600, 500_000, '2026-12-06T18:00', '1B Turbo'),
    lv(3, 'NLH Championship', 'NLH', 1100, 5_000_000, '2026-12-07T11:00', '1C'),
    lv(5, 'HORSE (2 Day)', 'Mix', 1100, 0, '2026-12-07T11:00'),
    lv(6, 'PLO $500 Bounty', 'PLO', 1600, 100_000, '2026-12-07T13:00'),
    lv(3, 'NLH Championship', 'NLH', 1100, 5_000_000, '2026-12-08T11:00', '1D'),
    lv(7, "No Limit Hold'em (2 Day)", 'NLH', 1600, 1_000_000, '2026-12-09T11:00'),
    lv(3, 'NLH Championship', 'NLH', 0, 5_000_000, '2026-12-09T12:00', '2'),
    lv(8, 'PLO $1,000 Bounty', 'PLO', 3000, 250_000, '2026-12-09T13:00'),
    lv(9, 'PLO', 'PLO', 3000, 250_000, '2026-12-12T13:00'),
    lv(10, 'Main Event', 'NLH', 10400, 0, '2026-12-13T11:00', '1A'),
    lv(11, 'Ladies NLH Championship (2 Day)', 'NLH', 1100, 250_000, '2026-12-13T11:00'),
    lv(12, 'TORSE (2 Day)', 'Mix', 1100, 0, '2026-12-13T11:00'),
    lv(13, 'PLO', 'PLO', 1600, 1_000_000, '2026-12-13T12:00', '1A'),
    lv(10, 'Main Event', 'NLH', 10400, 0, '2026-12-14T11:00', '1B'),
    lv(13, 'PLO', 'PLO', 1600, 1_000_000, '2026-12-14T12:00', '1B'),
    lv(14, 'Mixed Triple Draw (A-5, 2-7, Badugi) (2 Day)', 'Mix', 1100, 0, '2026-12-14T12:00'),
    lv(15, 'PLO Turbo', 'PLO', 1100, 100_000, '2026-12-14T19:00'),
    lv(10, 'Main Event', 'NLH', 10400, 0, '2026-12-15T11:00', '1C'),
    lv(16, 'Big O', 'Mix', 1100, 0, '2026-12-15T12:00'),
    lv(17, 'PLO Progressive Bounty (PKO)', 'PLO', 3000, 250_000, '2026-12-15T13:00'),
    lv(18, 'NLH $500 Bounty Turbo', 'NLH', 1600, 100_000, '2026-12-15T19:00'),
    lv(19, "No Limit Hold'em", 'NLH', 1100, 1_000_000, '2026-12-16T11:00', '1A'),
    lv(10, 'Main Event', 'NLH', 0, 0, '2026-12-16T12:00', '2'),
    lv(20, 'PLO 6-Max', 'PLO', 10500, 0, '2026-12-16T13:00'),
    lv(19, "No Limit Hold'em", 'NLH', 1100, 1_000_000, '2026-12-16T19:00', '1B Turbo'),
    lv(21, 'Seniors NLH Championship (3 Day)', 'NLH', 1100, 500_000, '2026-12-17T11:00'),
    lv(22, 'Mixed Championship (2 Day)', 'Mix', 1600, 0, '2026-12-17T11:00'),
    lv(23, "No Limit Hold'em", 'NLH', 3000, 2_000_000, '2026-12-17T12:00', '1A'),
    lv(24, 'NLH High Roller (2 Day)', 'NLH', 25800, 0, '2026-12-17T13:00'),
    lv(23, "No Limit Hold'em", 'NLH', 3000, 2_000_000, '2026-12-18T12:00', '1B'),
    lv(25, 'Limit Omaha 8 Championship (2 Day)', 'Mix', 1600, 0, '2026-12-18T12:00'),
    lv(26, 'NLH 6-Max', 'NLH', 10500, 0, '2026-12-18T13:00'),
    lv(27, 'NLH Turbo', 'NLH', 1100, 100_000, '2026-12-18T18:00'),
    lv(28, 'Seniors High Roller (3 Day)', 'NLH', 5000, 250_000, '2026-12-19T11:00'),
    lv(29, 'NLH Mystery Bounty', 'NLH', 1600, 1_000_000, '2026-12-19T11:00', '1A'),
    lv(30, 'PLO', 'PLO', 10500, 0, '2026-12-19T13:00'),
    lv(31, 'NLH 6-Max', 'NLH', 3000, 500_000, '2026-12-19T13:00'),
    lv(32, 'TORSE Championship (2 Day)', 'Mix', 1600, 0, '2026-12-19T13:00'),
    lv(29, 'NLH Mystery Bounty', 'NLH', 1600, 1_000_000, '2026-12-19T19:00', '1B Turbo'),
    lv(29, 'NLH Mystery Bounty', 'NLH', 1600, 1_000_000, '2026-12-20T11:00', '1C'),
    lv(33, 'NLH 8-Max', 'NLH', 10500, 0, '2026-12-20T13:00'),
    lv(29, 'NLH Mystery Bounty', 'NLH', 1600, 1_000_000, '2026-12-20T19:00', '1D Turbo'),
    lv(34, "No Limit Hold'em", 'NLH', 1100, 100_000, '2026-12-21T12:00'),
  ],
};

export const FESTIVALS: Festival[] = [BAHAMAS_DEC_2026, LAS_VEGAS_DEC_2026];

/** Epoch ms of a local venue time ('YYYY-MM-DDTHH:MM'). */
export function venueTime(f: Pick<Festival, 'utcOffset'>, local: string): number {
  const [d, hm] = local.split('T');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi] = hm.split(':').map(Number);
  return Date.UTC(y, mo - 1, da, h, mi) - f.utcOffset * 60_000;
}

/** "Event #12 · Flight A" style label. */
export function eventTitle(e: FestivalEvent): string {
  return e.unnumbered ? e.name : `#${e.number} ${e.name}`;
}

/** Local day key 'YYYY-MM-DD', for grouping. */
export function eventDay(e: FestivalEvent): string {
  return e.start.slice(0, 10);
}
