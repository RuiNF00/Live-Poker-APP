// Published festival schedules the player can plan from. Each one is copied
// from the organiser's own page (see `source`) and checked by hand: buy-ins
// include the fee, times are local to the venue. When a schedule changes,
// update the rows and `source.checked` together.

import { ESPINHO_DEC_2026, LISBOA_NOV_2026, PERALADA_NOV_2026, PRAGUE_DEC_2026, PUNTA_DEL_ESTE_DEC_2026, SAO_PAULO_NOV_2026, TORRELODONES_NOV_2026 } from './festivals-nov-2026';

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
  /** Official dates, 'YYYY-MM-DD', for a festival whose event schedule isn't out yet (no events). */
  dates?: { from: string; to: string };
  /** 'YYYY-MM' it usually runs in, for a festival with no dates out yet: only orders the list, never shown as dates. */
  month?: string;
  /** Added by the player ("Adicionar o meu festival"): their own name, no source, kept on the phone. */
  own?: boolean;
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
 * Starting stack and level length per tournament (`number` below), from the
 * organiser's schedule PDF:
 * https://cdn.wynnresorts.com/image/upload/v1757097329/visitwynn_pdfs_files/Poker/WPT/WPT_World_Championship_Schedule.pdf
 * Turbo flights run a faster structure the PDF doesn't give, and a Day 2 is a restart: neither gets one.
 * The High Roller (24) is on the PDF's page 2: 40-min levels, 60 later.
 */
const LV_STRUCTURE: Record<number, [stack: number, levelMinutes: number]> = {
  1: [30000, 30],
  2: [40000, 40],
  3: [40000, 40],
  4: [40000, 40],
  5: [40000, 40],
  6: [30000, 30],
  7: [40000, 40],
  8: [30000, 30],
  9: [30000, 30],
  10: [100000, 60],
  11: [40000, 40],
  12: [40000, 40],
  13: [40000, 40],
  14: [40000, 40],
  15: [30000, 20],
  16: [30000, 30],
  17: [30000, 30],
  18: [30000, 20],
  19: [40000, 40],
  20: [100000, 30],
  21: [40000, 40],
  22: [40000, 40],
  23: [40000, 40],
  24: [200000, 40],
  25: [40000, 40],
  26: [100000, 30],
  27: [30000, 20],
  28: [50000, 60],
  29: [40000, 40],
  30: [100000, 30],
  31: [30000, 30],
  32: [40000, 40],
  33: [100000, 30],
  34: [30000, 30],
  35: [35000, 30],
  36: [30000, 30],
  37: [35000, 30],
  38: [35000, 30],
  39: [35000, 30],
  40: [20000, 20],
  41: [35000, 30],
  42: [20000, 20],
  43: [30000, 20],
  44: [20000, 20],
  45: [20000, 20],
  46: [30000, 20],
  47: [20000, 25],
  48: [30000, 20],
  49: [20000, 25],
  50: [30000, 20],
  51: [35000, 30],
  52: [20000, 25],
  53: [20000, 25],
  54: [30000, 20],
  55: [30000, 30],
  56: [30000, 30],
  57: [20000, 25],
  58: [20000, 20],
  59: [20000, 25],
  60: [30000, 20],
  61: [40000, 40],
  62: [20000, 25],
  63: [20000, 25],
  64: [20000, 25],
  65: [30000, 20],
  66: [20000, 25],
  67: [20000, 25],
  68: [30000, 30],
  69: [35000, 30],
  70: [20000, 25],
  71: [20000, 20],
  72: [20000, 20],
  73: [20000, 20],
  74: [20000, 15],
  75: [30000, 30],
  76: [20000, 20],
  77: [20000, 20],
  78: [20000, 20],
  79: [30000, 20],
  80: [30000, 30],
  81: [35000, 30],
  82: [30000, 20],
  83: [30000, 20],
  84: [20000, 25],
  85: [40000, 30],
};
const lvStructure = (e: FestivalEvent): FestivalEvent => {
  const x = e.day2 || e.flight?.includes('Turbo') ? undefined : LV_STRUCTURE[e.number];
  return x ? { ...e, stack: x[0], levelMinutes: x[1] } : e;
};

/**
 * The Wynn Las Vegas festival, 27 Nov – 21 Dec 2026, side events and
 * satellites included. Source: the organiser's schedule page, read on 2026-10-17
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
    'Ainda falta o torneio de $800 com seis flights de 30 de novembro a 2 de dezembro (Dia 2 a 3 de dezembro): o organizador não publicou a hora de cada flight.',
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
    // Under $1,000 and satellites, from the schedule PDF.
    lv(35, 'TORSE', 'Mix', 600, 0, '2026-11-27T12:00'),
    lv(36, 'PLO', 'PLO', 400, 0, '2026-11-27T13:00'),
    lv(37, 'Mixed Triple Draw (A-5, 2-7, Badugi)', 'Mix', 600, 0, '2026-11-28T12:00'),
    lv(38, 'Limit Omaha 8', 'Mix', 600, 0, '2026-11-30T12:00'),
    lv(39, 'Limit Omaha 8/Stud 8', 'Mix', 600, 0, '2026-12-01T12:00'),
    lv(40, 'Satellite (2 × $1,100 seats)', 'NLH', 400, 0, '2026-12-03T19:00'),
    lv(41, 'HORSE', 'Mix', 600, 0, '2026-12-04T12:00'),
    lv(42, 'Satellite (2 × $1,100 seats)', 'NLH', 400, 0, '2026-12-04T19:00'),
    lv(43, 'NLH Turbo', 'NLH', 600, 50_000, '2026-12-05T21:00'),
    lv(44, 'Satellite to NLH Championship', 'NLH', 200, 0, '2026-12-06T12:00'),
    lv(45, 'Satellite (2 × $1,100 seats)', 'NLH', 400, 0, '2026-12-06T19:00'),
    lv(46, 'NLH Turbo', 'NLH', 600, 50_000, '2026-12-06T21:00'),
    lv(47, 'Satellite to NLH Championship + Main Event', 'NLH', 1600, 0, '2026-12-07T19:00'),
    lv(48, 'NLH Turbo', 'NLH', 600, 50_000, '2026-12-07T21:00'),
    lv(49, 'Satellite to Main Event', 'NLH', 1100, 0, '2026-12-08T19:00'),
    lv(50, 'NLH Turbo', 'NLH', 600, 50_000, '2026-12-08T21:00'),
    lv(51, 'Limit Omaha 8', 'Mix', 800, 0, '2026-12-09T13:00'),
    lv(52, 'Satellite to Main Event', 'NLH', 1100, 0, '2026-12-09T14:00'),
    lv(53, 'Satellite to Main Event', 'NLH', 1100, 0, '2026-12-09T19:00'),
    lv(54, 'NLH Turbo', 'NLH', 600, 50_000, '2026-12-09T21:00'),
    lv(55, 'NLH Mystery Bounty', 'NLH', 400, 3_000_000, '2026-12-10T10:00', '1A'),
    lv(55, 'NLH Mystery Bounty', 'NLH', 400, 3_000_000, '2026-12-10T18:00', '1B Turbo'),
    lv(55, 'NLH Mystery Bounty', 'NLH', 400, 3_000_000, '2026-12-11T10:00', '1C'),
    lv(55, 'NLH Mystery Bounty', 'NLH', 400, 3_000_000, '2026-12-11T18:00', '1D Turbo'),
    lv(55, 'NLH Mystery Bounty', 'NLH', 0, 3_000_000, '2026-12-12T14:00', '2'),
    lv(56, "No Limit Hold'em", 'NLH', 800, 100_000, '2026-12-12T10:00'),
    lv(57, 'Satellite to Main Event', 'NLH', 1100, 0, '2026-12-12T14:00'),
    lv(58, 'Satellite to Ladies NLH Championship', 'NLH', 200, 0, '2026-12-12T16:00'),
    lv(59, 'Satellite to Main Event', 'NLH', 1100, 0, '2026-12-12T19:00'),
    lv(60, 'NLH Turbo', 'NLH', 600, 50_000, '2026-12-12T21:00'),
    lv(61, "No Limit Hold'em", 'NLH', 800, 500_000, '2026-12-13T11:00', '1A'),
    lv(61, "No Limit Hold'em", 'NLH', 800, 500_000, '2026-12-14T11:00', '1B'),
    lv(62, 'Satellite to Main Event', 'NLH', 1100, 0, '2026-12-13T12:00'),
    lv(63, 'Satellite to Main Event', 'NLH', 1100, 0, '2026-12-13T18:00'),
    lv(64, 'Satellite to Main Event', 'NLH', 1100, 0, '2026-12-14T18:00'),
    lv(84, 'Satellite to Main Event', 'NLH', 1100, 0, '2026-12-14T12:00'),
    // The $600 opener, flight times from the PDF (read by the research thread on Rui's Mac).
    lv(85, "No Limit Hold'em", 'NLH', 600, 400_000, '2026-11-27T11:00', '1A'),
    lv(85, "No Limit Hold'em", 'NLH', 600, 400_000, '2026-11-27T17:00', '1B'),
    lv(85, "No Limit Hold'em", 'NLH', 600, 400_000, '2026-11-28T11:00', '1C'),
    lv(85, "No Limit Hold'em", 'NLH', 600, 400_000, '2026-11-28T17:00', '1D'),
    lv(85, "No Limit Hold'em", 'NLH', 600, 400_000, '2026-11-29T11:00', '1E'),
    lv(85, "No Limit Hold'em", 'NLH', 600, 400_000, '2026-11-29T18:00', '1F Turbo'),
    lv(85, "No Limit Hold'em", 'NLH', 0, 400_000, '2026-11-30T13:00', '2'),
    lv(65, 'NLH Turbo', 'NLH', 600, 50_000, '2026-12-14T21:00'),
    lv(66, 'Satellite to Main Event', 'NLH', 1100, 0, '2026-12-15T11:00'),
    lv(67, 'Satellite to Main Event', 'NLH', 1100, 0, '2026-12-15T18:00'),
    lv(68, 'PLO Double Board Bomb Pot', 'PLO', 800, 0, '2026-12-16T12:00'),
    lv(69, 'HORSE', 'Mix', 800, 0, '2026-12-16T13:00'),
    lv(70, 'Satellite to NLH High Roller', 'NLH', 3000, 0, '2026-12-16T18:00'),
    lv(71, 'Satellite to $3,000 NLH', 'NLH', 400, 0, '2026-12-16T18:00'),
    lv(72, 'Satellite to $3,000 NLH', 'NLH', 400, 0, '2026-12-17T14:00'),
    lv(73, 'Satellite to $3,000 NLH', 'NLH', 400, 0, '2026-12-17T19:00'),
    lv(74, 'Satellite to $3,000 NLH', 'NLH', 400, 0, '2026-12-18T10:00'),
    lv(75, "No Limit Hold'em", 'NLH', 600, 100_000, '2026-12-18T12:00'),
    lv(76, 'Satellite to Seniors High Roller', 'NLH', 600, 0, '2026-12-18T14:00'),
    lv(77, 'Satellite to NLH Mystery Bounty', 'NLH', 300, 0, '2026-12-19T12:00'),
    lv(78, 'Satellite to NLH Mystery Bounty', 'NLH', 300, 0, '2026-12-19T17:00'),
    lv(79, 'NLH 6-Max Turbo', 'NLH', 600, 50_000, '2026-12-19T18:00'),
    lv(80, "No Limit Hold'em", 'NLH', 600, 50_000, '2026-12-20T12:00'),
    lv(81, 'Mixed Triple Draw (A-5, 2-7, Badugi)', 'Mix', 600, 0, '2026-12-20T13:00'),
    lv(82, '5-Card PLO Turbo', 'PLO', 600, 50_000, '2026-12-20T18:00'),
    lv(83, 'NLH Turbo', 'NLH', 600, 50_000, '2026-12-21T18:00'),
  ]
    .map(lvStructure)
    .sort((a, b) => a.start.localeCompare(b.start)),
};

/**
 * Brazil's summer series, 22–30 January 2027, on the Bahia coast. Only the
 * dates are official so far (organiser's "próximas etapas" page, read on
 * 2026-10-17): the planner shows them and the events go in when the schedule
 * is published. Generic name, no event brand or resort name.
 */
export const BAHIA_JAN_2027: Festival = {
  id: 'bahia-jan-2027',
  name: 'Bahia, janeiro 2027',
  venue: 'Bahia',
  city: 'Brasil',
  currency: 'R$',
  utcOffset: -180,
  // https://bsop.com.br/proximas-etapas/
  source: { label: 'calendário oficial do organizador', checked: '2026-10-17' },
  notes: [],
  events: [],
  dates: { from: '2027-01-22', to: '2027-01-30' },
};

/**
 * The first stop of Spain's national series, in Barcelona, usually in March.
 * The 2027 dates aren't published (checked 2026-10-17): no dates, no events,
 * only the month it usually runs in, said as such. Generic name, no brand.
 */
export const BARCELONA_MAR_2027: Festival = {
  id: 'barcelona-mar-2027',
  name: 'Barcelona, março 2027',
  venue: 'Barcelona',
  city: 'Espanha',
  currency: '€',
  utcOffset: 60,
  source: { label: 'calendário oficial do organizador', checked: '2026-10-17' },
  notes: ['Datas a confirmar: o organizador ainda não publicou as datas de 2027. Costuma ser em março.'],
  month: '2027-03',
  events: [],
};

/**
 * A long series in Los Angeles, 15 January – 7 March 2027, Main Event 26 February – 3 March.
 * Dates announced by the organiser in September 2026 (press coverage, read
 * 2026-10-17 by the research thread). Generic name, no event brand or casino.
 */
export const LOS_ANGELES_JAN_2027: Festival = {
  id: 'los-angeles-jan-2027',
  name: 'Los Angeles, jan a mar 2027',
  venue: 'Los Angeles',
  city: 'EUA',
  currency: '$',
  utcOffset: -480,
  // https://www.bonus.com/news/wpt-la-poker-classic-returns-2027/ (organiser announcement, September 2026)
  source: { label: 'datas anunciadas pelo organizador', checked: '2026-10-17' },
  notes: ['Evento principal de 26 de fevereiro a 3 de março.'],
  events: [],
  dates: { from: '2027-01-15', to: '2027-03-07' },
};

/**
 * Ireland's Easter festival, 18–28 March 2027, Main Event 21–26 March. Dates as
 * announced with the organiser's qualifier programme (read 2026-10-17).
 * Generic name, no brand.
 */
export const DUBLIN_MAR_2027: Festival = {
  id: 'dublin-mar-2027',
  name: 'Dublin, março 2027',
  venue: 'Dublin',
  city: 'Irlanda',
  currency: '€',
  utcOffset: 0,
  // https://irishpokeropen.com/blog/2026/10/15/every-days-st-paddys-day-dates-announced-for-2027-irish-open/
  source: { label: 'datas anunciadas pelo organizador', checked: '2026-10-17' },
  notes: ['Evento principal de 21 a 26 de março.'],
  events: [],
  dates: { from: '2027-03-18', to: '2027-03-29' },
};

/**
 * Australia's big series, 8–24 April 2027 (the venue's announcement, August
 * 2026; read 2026-10-17). Moved from January. Generic name, no brand or venue.
 */
export const MELBOURNE_APR_2027: Festival = {
  id: 'melbourne-apr-2027',
  name: 'Melbourne, abril 2027',
  venue: 'Melbourne',
  city: 'Austrália',
  currency: 'A$',
  utcOffset: 600,
  // https://asgam.com/2026/08/24/crown-melbourne-announces-april-dates-for-2027-aussie-millions/
  source: { label: 'datas anunciadas pelo organizador', checked: '2026-10-17' },
  notes: [],
  events: [],
  dates: { from: '2027-04-08', to: '2027-04-24' },
};

/**
 * Paris in February. 2027 dates not published (2026: 18 Feb – 1 Mar).
 */
export const PARIS_FEB_2027: Festival = {
  id: 'paris-feb-2027',
  name: 'Paris, fevereiro 2027',
  venue: 'Paris',
  city: 'França',
  currency: '€',
  utcOffset: 60,
  // https://www.pokernews.com/news/2025/08/pokerstars-confirms-european-poker-tour-paris-returns-49393.htm
  source: { label: 'edições anteriores do festival', checked: '2026-10-17' },
  notes: ['Datas a confirmar: o organizador ainda não publicou as datas de 2027. Costuma ser em fevereiro.'],
  month: '2027-02',
  events: [],
};

/**
 * Prague in spring. 2027 dates not published (2026: 31 Mar – 12 Apr).
 */
export const PRAGUE_APR_2027: Festival = {
  id: 'praga-apr-2027',
  name: 'Praga, abril 2027',
  venue: 'Praga',
  city: 'Chéquia',
  currency: '€',
  utcOffset: 120,
  // https://www.pokernews.com/news/2025/12/2026-wsop-europe-schedule-released-new-home-new-dates-50239.htm
  source: { label: 'edições anteriores do festival', checked: '2026-10-17' },
  notes: ['Datas a confirmar: o organizador ainda não publicou as datas de 2027. Costuma ser entre o fim de março e meados de abril.'],
  month: '2027-04',
  events: [],
};

/**
 * Brazil, Rio Quente stop. 2027 dates not published (2026: 30 Apr – 5 May).
 */
export const GOIAS_MAY_2027: Festival = {
  id: 'goias-may-2027',
  name: 'Goiás, maio 2027',
  venue: 'Rio Quente',
  city: 'Brasil',
  currency: 'R$',
  utcOffset: -180,
  // https://pokerfuse.com/live-poker/bsop/
  source: { label: 'edições anteriores do festival', checked: '2026-10-17' },
  notes: ['Datas a confirmar: o organizador ainda não publicou as datas de 2027. Costuma ser entre o fim de abril e o início de maio.'],
  month: '2027-05',
  events: [],
};

/**
 * Monte Carlo in spring. 2027 dates not published (2026: 30 Apr – 10 May).
 */
export const MONACO_MAY_2027: Festival = {
  id: 'monaco-may-2027',
  name: 'Mónaco, maio 2027',
  venue: 'Monte Carlo',
  city: 'Mónaco',
  currency: '€',
  utcOffset: 120,
  // https://www.pokernews.com/news/2026/04/2026-ept-monte-carlo-series-preview-51053.htm
  source: { label: 'edições anteriores do festival', checked: '2026-10-17' },
  notes: ['Datas a confirmar: o organizador ainda não publicou as datas de 2027. Costuma ser entre o fim de abril e meados de maio.'],
  month: '2027-05',
  events: [],
};

/**
 * Estoril in May. 2027 dates not published (2026: 12–17 May).
 */
export const ESTORIL_MAY_2027: Festival = {
  id: 'estoril-may-2027',
  name: 'Estoril, maio 2027',
  venue: 'Estoril',
  city: 'Portugal',
  currency: '€',
  utcOffset: 60,
  // https://www.pokernews.com/news/2026/04/estoril-poker-fest-2026-500-main-event-full-schedule-51135.htm
  source: { label: 'edições anteriores do festival', checked: '2026-10-17' },
  notes: ['Datas a confirmar: o organizador ainda não publicou as datas de 2027. Costuma ser em meados de maio.'],
  month: '2027-05',
  events: [],
};

/**
 * The summer series in Las Vegas. 2027 dates not published; every year it runs
 * from the last week of May to mid-July, Main Event in July.
 */
export const LAS_VEGAS_SUMMER_2027: Festival = {
  id: 'las-vegas-summer-2027',
  name: 'Las Vegas, verão 2027',
  venue: 'Las Vegas',
  city: 'EUA',
  currency: '$',
  utcOffset: -420,
  // https://pokerfuse.com/live-poker/wsop/wsop-2027/
  source: { label: 'edições anteriores do festival', checked: '2026-10-17' },
  notes: ['Datas a confirmar: o organizador ainda não publicou as datas de 2027. Costuma ir da última semana de maio a meados de julho, com o evento principal em julho.'],
  month: '2027-06',
  events: [],
};

export const FESTIVALS: Festival[] = [
  BAHAMAS_DEC_2026,
  LAS_VEGAS_DEC_2026,
  LOS_ANGELES_JAN_2027,
  BAHIA_JAN_2027,
  PARIS_FEB_2027,
  BARCELONA_MAR_2027,
  DUBLIN_MAR_2027,
  MELBOURNE_APR_2027,
  PRAGUE_APR_2027,
  GOIAS_MAY_2027,
  MONACO_MAY_2027,
  ESTORIL_MAY_2027,
  LAS_VEGAS_SUMMER_2027,
  // November 2026 (festivals-nov-2026.ts). Lists sort by start; FESTIVALS[0] stays the first-run checklist's festival.
  TORRELODONES_NOV_2026,
  SAO_PAULO_NOV_2026,
  LISBOA_NOV_2026,
  PERALADA_NOV_2026,
  ESPINHO_DEC_2026,
  PRAGUE_DEC_2026,
  PUNTA_DEL_ESTE_DEC_2026,
];

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

/** First and last day, 'YYYY-MM-DD': from the schedule, else the official dates; null when neither is out. */
export function festivalSpan(f: Festival): { from: string; to: string } | null {
  if (f.events.length) {
    const days = f.events.map(eventDay).sort();
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
