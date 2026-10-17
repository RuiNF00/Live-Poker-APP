import type { Statement } from '@/lib/backing-link';
import type { Tourney } from '@/poker/tourney';
import type { SizeMemory } from '@/poker/entry';
import type { AnteType, GameKind, StageId } from '@/poker/types';

import { deviceCurrency } from './currencies';

export interface Session {
  id: string;
  kind: GameKind;
  name: string;
  venue: string;
  currency: string;
  startedAt: number;
  endedAt?: number;
  /** Paused intervals, so hourly rate only counts time at the table. */
  breaks: { start: number; end?: number }[];
  /** Cost of one entry (buy-in incl. fee) — or one cash buy-in. */
  buyIn: number;
  /** Entries for MTT (1 + re-entries), buy-ins for cash (1 + rebuys). */
  entries: number;
  addOn: number;
  /** Prize (MTT) or cash-out (cash). */
  cashOut: number;
  finish?: number;
  field?: number;
  /** Travel, hotel, food: comes off your result. */
  expenses?: number;
  /** Dealer tips: off your result like expenses, with their own total. */
  tips?: number;
  /** Hands dealt to you, when the player counts them (for hands per hour). */
  handsDealt?: number;
  /** Mental game journal: a few taps before and after. Private: never in a share, link or statement. */
  mind?: MindCheck;
  /** Action sold, in total: `sold` in % of the whole, `markup` as a multiplier (1.1 = 10%).
   *  Kept as the summary of `stakes` so older copies of the app still read it. */
  staking?: { sold: number; markup: number };
  /** Who has a piece of this session. Absent on older sessions: `staking` is then one unnamed stake. */
  stakes?: Stake[];
  /** Public live link for backers (sweatbook.poker/live/<id>); token lets this phone update or remove it. */
  /** Backer live link. The venue is only on the page when the player turns it on (where they are is their business). */
  live?: { id: string; token: string; showVenue?: boolean };
  /** Your cut of a makeup package credited to this session. Derived: the store fills it in from the packages (withCuts). */
  makeupCut?: number;
  /** What swaps add to (their share of the other player's prizes) or take from (your share given away) this session. Derived (withSwaps). */
  swapNet?: number;
  // Live table state, used to pre-fill every new hand.
  sb: number;
  bb: number;
  ante: number;
  anteType: AnteType;
  level?: number;
  /** Tournament level length; drives the level-up reminder and the lock-screen countdown. */
  levelMinutes?: number;
  /** When the current level started (reset on every level change). */
  levelStartedAt?: number;
  stage?: StageId;
  tableSize: number;
  stack: number;
  stackLog: { t: number; stack: number; level?: number }[];
  /** Names at the table by seat (0 = seat 1). */
  roster: string[];
  notes: string;
  /** How it went, tapped when ending: focus, tilt, table. */
  tags?: string[];
  /** Tournament mode: blind structure, field and payouts (see poker/tourney.ts). */
  tourney?: Tourney;
  /** Tournament day this session is on, when past Day 1 (see store/multi-day.ts). */
  day?: number;
  /** Set when a tournament day ended with chips in the bag: the session waits for its next day. */
  bag?: { stack: number; at: number };
  /** Where it was played. Missing = live (the app's home turf). */
  format?: GameFormat;
  /** Bankroll it counts towards. Missing (older data): the first bankroll in its currency. */
  bankrollId?: string;
  /** Country it was played in (ISO code, 'US', 'PT'…), for the tax report. */
  country?: string;
  /** Tax the cashier kept back from the prize, in the session's currency. */
  withheld?: Withholding;
  /** Receipts and tax forms, kept as files next to the app's data. */
  docs?: SessionDoc[];
  updatedAt?: number;
}

/** 1 to 5, tapped. */
export type Scale = 1 | 2 | 3 | 4 | 5;

/** Before the session: how the player arrives. After: how tilted it got, and one line. Every field is optional. */
export interface MindCheck {
  energy?: Scale;
  focus?: Scale;
  /** Hours slept the night before. */
  sleep?: number;
  mood?: string;
  /** 1 calm, 5 full tilt. */
  tilt?: Scale;
  note?: string;
}

/** 'recover': asking it back (e.g. 1042-S with a treaty or an ITIN return); 'final': credited on your return or not recoverable. */
export interface Withholding {
  amount: number;
  form?: 'W-2G' | '1042-S' | 'other';
  status: 'recover' | 'recovered' | 'final';
}

export interface SessionDoc {
  id: string;
  name: string;
  /** File name inside the app's documents folder (the folder path changes between installs). */
  file: string;
  kind: 'receipt' | 'form' | 'other';
  addedAt: number;
}

export type GameFormat = 'live' | 'online';

/** A pot of money in one currency: sessions plus deposits and withdrawals. */
export interface Bankroll {
  id: string;
  name: string;
  /** Never changes after creation: sessions and transfers are in this currency. */
  currency: string;
  createdAt: number;
  updatedAt?: number;
  /** The player's own limits for this bankroll. */
  rules?: BankrollRules;
  /** A planned shot at a bigger cash stake. */
  shot?: ShotPlan;
}

/** A shot at a bigger stake: buy-ins set aside for it, and how many lost before going back. */
export interface ShotPlan {
  sb: number;
  bb: number;
  /** Buy-ins (100 big blinds) set aside for the shot. */
  buyIns: number;
  /** Buy-ins lost at this stake before going back to `back`. */
  stopAfter: number;
  back: { sb: number; bb: number };
  startedAt: number;
}

/** Bankroll rules; every amount is in the bankroll's currency. */
export interface BankrollRules {
  /** Buy-ins (100 big blinds each) the bankroll must hold to play a cash stake. */
  cashBuyIns: number;
  /** Buy-ins it must hold to play a tournament. */
  mttBuyIns: number;
  /** Stop after losing this much; 0 is off. */
  stopLoss: number;
  stopLossPer: 'session' | 'day';
  /** Balance to reach; 0 is off. */
  target: number;
}

/** Money moved into or out of a bankroll (not poker results). */
export interface Transfer {
  id: string;
  bankrollId: string;
  kind: 'deposit' | 'withdrawal';
  /** Always positive; `kind` gives the direction. */
  amount: number;
  at: number;
  note: string;
  updatedAt?: number;
}

/**
 * Poker expenses. Shared by trips and the tax report, so new kinds go at the
 * end and none is ever renamed (they are stored).
 */
export type ExpenseKind = 'flight' | 'hotel' | 'food' | 'coaching' | 'software' | 'other';

/** Money spent on a trip (not poker results). */
export interface Expense {
  id: string;
  kind: ExpenseKind;
  /** Always positive. */
  amount: number;
  /** The trip's currency or the one in `Trip.fx` (a flight paid at home). */
  currency: string;
  at: number;
  note: string;
}

/**
 * A trip to a festival or a card room: every session started between `from`
 * and `to` counts towards it, and its expenses come off the result.
 */
export interface Trip {
  id: string;
  name: string;
  venue: string;
  currency: string;
  /** Start of the first day and end of the last, inclusive. */
  from: number;
  to: number;
  /** 1 unit of the trip currency in another one (usually the player's), typed by the player. */
  fx?: { currency: string; rate: number };
  /** Made from a festival plan (see poker/festivals). */
  festivalId?: string;
  expenses: Expense[];
  createdAt: number;
  updatedAt?: number;
}

/** One backer's piece of one session. */
export interface Stake {
  /** Absent: sold without a name (older sessions, or a quick sale). */
  backerId?: string;
  /** Part of a package: share and terms come from it. */
  packageId?: string;
  /** % of the whole action. */
  share: number;
  /** 1.1 = 10% markup. Always 1 in a makeup package. */
  markup: number;
  /** The backer hasn't paid for this piece yet: it counts against their balance. */
  unpaid?: boolean;
}

export interface Backer {
  id: string;
  name: string;
  note: string;
  /** Random id that ties the statements sent to this backer together on their phone. */
  shareKey?: string;
  /** Each time you sent them their statement, with the balance it showed (newest last). */
  reminders?: { at: number; balance: number }[];
  createdAt: number;
  updatedAt?: number;
}

/**
 * Several sessions sold to one backer on the same terms.
 * - 'action': they buy `share`% of each tournament at `markup`; every session settles on its own.
 * - 'makeup': they put up `share`% of the buy-ins; losses carry over (makeup) and you keep
 *   `playerCut`% of their profit only once the package as a whole is up.
 */
export interface StakePackage {
  id: string;
  backerId: string;
  name: string;
  kind: 'action' | 'makeup';
  share: number;
  markup: number;
  playerCut: number;
  /** Makeup deals: losses carried over from the package before it (the player chose to carry them when closing it). */
  makeupIn?: number;
  createdAt: number;
  closedAt?: number;
  updatedAt?: number;
}

/** Money between you and a backer. amount > 0: you paid them; < 0: they paid you. */
/** A player you back: the latest statement they sent you (see lib/backing-link). */
export interface BackedPlayer {
  /** The statement's id: one per player and backer. */
  id: string;
  statement: Statement;
  createdAt: number;
  updatedAt?: number;
}

export interface BackerPayment {
  id: string;
  backerId: string;
  amount: number;
  at: number;
  note: string;
  createdAt: number;
  updatedAt?: number;
}

/** Stored in Portuguese; translate with t() only when shown. */
export const PLAYER_TAGS = [
  'Fish',
  'Reg',
  'Agressivo',
  'Passivo',
  'Tight',
  'Loose',
  'Calling station',
  'Bluffer',
  'Nit',
  'Tilt',
];

export interface PlayerNote {
  id: string;
  name: string;
  /** How to recognise them at the table. */
  look: string;
  tags: string[];
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  inBB: boolean;
  currency: string;
  nickname: string;
  defaultTableSize: number;
  onboarded: boolean;
  /** Shared hands: show opponents' names (off: they appear as positions). */
  shareNames: boolean;
  /** Shared hands: include your notes. */
  shareNotes: boolean;
  /** Bankroll new sessions go to. */
  bankrollId?: string;
  /** Privacy mode: every amount on screen shows ••• (at the table, on a train). Files and share images keep real figures. */
  hideAmounts?: boolean;
  /** Mental journal: ask how you arrive and how you leave. Missing = yes. */
  mindAsk?: boolean;
  /** Home-screen widget: show this week's result. Off by default: a home screen is seen by whoever sits next to you. */
  widgetResult?: boolean;
  /** Rates typed for currencies the ECB doesn't publish (ARS, CLP...): ISO code → units per 1 EUR. */
  fxManual?: Record<string, number>;
  /** Count swaps in results (Session.swapNet). Missing = yes. */
  includeSwaps?: boolean;
  /** Logging-streak pauses (trips, breaks): those weeks never break it. */
  streakPauses?: { from: number; to?: number }[];
  /** Haptic feedback; on unless turned off in Settings. */
  haptics?: boolean;
  /** Hand entry: the last bet/raise size per spot, per game kind, offered as a one-tap chip. */
  sizes?: { cash?: SizeMemory; mtt?: SizeMemory };
  /** Local notification on the 1st with last month's recap. Missing = on (it only goes out once notifications are allowed). */
  monthRecap?: boolean;
  /** Amounts and results in notification text (they show on a locked phone). Missing = off. */
  notifyAmounts?: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  inBB: false,
  currency: deviceCurrency(),
  nickname: '',
  defaultTableSize: 9,
  onboarded: false,
  shareNames: false,
  shareNotes: false,
};
