import type { AnteType, GameKind, StageId } from '@/poker/types';

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
  /** Travel, hotel, tips: comes off your result. */
  expenses?: number;
  /** Action sold, in total: `sold` in % of the whole, `markup` as a multiplier (1.1 = 10%).
   *  Kept as the summary of `stakes` so older copies of the app still read it. */
  staking?: { sold: number; markup: number };
  /** Who has a piece of this session. Absent on older sessions: `staking` is then one unnamed stake. */
  stakes?: Stake[];
  /** Public live link for backers (sweatbook.poker/live/<id>); token lets this phone update or remove it. */
  live?: { id: string; token: string };
  /** Your cut of a makeup package credited to this session. Derived: the store fills it in from the packages (withCuts). */
  makeupCut?: number;
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
  /** Where it was played. Missing = live (the app's home turf). */
  format?: GameFormat;
  /** Bankroll it counts towards. Missing (older data): the first bankroll in its currency. */
  bankrollId?: string;
  updatedAt?: number;
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
  createdAt: number;
  closedAt?: number;
  updatedAt?: number;
}

/** Money between you and a backer. amount > 0: you paid them; < 0: they paid you. */
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
  /** Bankroll tab shows ••• instead of amounts (for looking at it at the table). */
  hideAmounts?: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  inBB: false,
  currency: '€',
  nickname: '',
  defaultTableSize: 9,
  onboarded: false,
  shareNames: false,
  shareNotes: true,
};
