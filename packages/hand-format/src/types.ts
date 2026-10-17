// Canonical hand record shared by the mobile app, the backend and the web share page.
// Amount semantics: every amount is in chips (or currency units for cash games).
// For bet / raise / allin, `amount` is the player's TOTAL contribution on that street
// after the action ("raise to"). For call it is optional: the engine computes it.

export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';
export type Suit = 's' | 'h' | 'd' | 'c';
export type Card = `${Rank}${Suit}`;

export type Street = 'preflop' | 'flop' | 'turn' | 'river';
export const STREETS: Street[] = ['preflop', 'flop', 'turn', 'river'];

export type ActionType =
  | 'post_sb'
  | 'post_bb'
  | 'post_ante'
  | 'post_straddle'
  | 'fold'
  | 'check'
  | 'call'
  | 'bet'
  | 'raise'
  | 'allin';

export interface Action {
  seat: number;
  type: ActionType;
  amount?: number;
}

export interface Player {
  seat: number;
  name?: string;
  stack: number;
  /** Known hole cards. Undefined/null = unknown (shown face down). */
  cards?: Card[] | null;
  isHero?: boolean;
}

export type TournamentStage =
  | 'early'
  | 'middle'
  | 'late'
  | 'bubble'
  | 'itm'
  | 'final_table'
  | 'heads_up';

export interface TournamentInfo {
  name?: string;
  buyIn?: number;
  stage?: TournamentStage;
  level?: number;
  playersLeft?: number;
  paidPlaces?: number;
}

export interface HandRecord {
  version: 1;
  game: 'NLHE' | 'PLO';
  format: 'tournament' | 'cash';
  currency?: string;
  blinds: { sb: number; bb: number; ante?: number; bbAnte?: boolean };
  tableSize: number;
  buttonSeat: number;
  players: Player[];
  board?: { flop?: [Card, Card, Card]; turn?: Card; river?: Card };
  /** Actions in order per street. Blind/ante posts belong in preflop. */
  actions: Partial<Record<Street, Action[]>>;
  /** Optional explicit winners; when absent the engine evaluates showdown. */
  winners?: { seat: number; amount: number }[];
  /** Seats that won at showdown when their cards are unknown (amounts are computed). */
  winnerSeats?: number[];
  tournament?: TournamentInfo;
  tags?: string[];
  notes?: string;
  playedAt?: string;
  location?: string;
}
