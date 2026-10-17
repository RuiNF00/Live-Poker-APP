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
  /** Action sold to backers: `sold` in % of the whole, `markup` as a multiplier (1.1 = 10%). */
  staking?: { sold: number; markup: number };
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
