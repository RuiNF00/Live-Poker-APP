import { t } from '../i18n';

// Core data model. A hand is stored as its inputs (table, blinds, actions,
// cards); every derived value (pots, stacks, winners) comes from engine.ts so
// the entry screen, the replayer, the web viewer and exports never disagree.

export type Suit = 's' | 'h' | 'd' | 'c';
/** Two-char card code: rank + suit, e.g. "As", "Td", "9c". */
export type CardCode = string;

export type Street = 'preflop' | 'flop' | 'turn' | 'river';
export const STREETS: Street[] = ['preflop', 'flop', 'turn', 'river'];

export type ActionKind = 'fold' | 'check' | 'call' | 'bet' | 'raise';

export interface HandAction {
  /** Index into Hand.players. */
  p: number;
  kind: ActionKind;
  /** For bet/raise: total committed on this street after the action. */
  to?: number;
}

export interface Player {
  name: string;
  /** Starting stack for the hand, in chips. */
  stack: number;
  /** Hole cards, when known. Hero's are always set once picked. */
  cards?: CardCode[];
  /** Optional id into the player-notes database. */
  playerId?: string;
}

export type GameKind = 'mtt' | 'cash';
export type AnteType = 'none' | 'bb' | 'all';

export type StageId = 'early' | 'mid' | 'bubble' | 'itm' | 'ft' | 'hu';

export interface GameInfo {
  kind: GameKind;
  /** Tournament name, or venue/game name for cash. */
  name: string;
  stage?: StageId;
  level?: number;
  sb: number;
  bb: number;
  ante: number;
  anteType: AnteType;
  currency: string;
  buyIn?: number;
  playersLeft?: number;
  venue?: string;
}

export interface Hand {
  v: 1;
  id: string;
  createdAt: number;
  updatedAt: number;
  sessionId?: string;
  game: GameInfo;
  /** Clockwise from seat 1. */
  players: Player[];
  /** Index of the dealer button in players. */
  button: number;
  /** Index of hero in players. */
  hero: number;
  actions: HandAction[];
  board: CardCode[];
  tags: string[];
  notes: string;
  title?: string;
  /** Manual winner(s) when showdown cards are unknown. */
  winners?: number[];
  /** Share id once uploaded. */
  shareId?: string;
  shareToken?: string;
}

export const STAGES: { id: StageId; label: string }[] = [
  { id: 'early', label: t('Início') },
  { id: 'mid', label: t('Meio') },
  { id: 'bubble', label: t('Bolha') },
  { id: 'itm', label: 'ITM' },
  { id: 'ft', label: t('Mesa final') },
  { id: 'hu', label: 'Heads-up' },
];

/** Stored on hands in Portuguese; translate with t() only when shown. */
export const DEFAULT_TAGS = [
  'Bluff',
  'Hero call',
  'Value',
  'Cooler',
  'Bad beat',
  'Dúvida',
  'Erro',
  'ICM',
  'Bolha',
  'Pote grande',
  'Read',
  'Rever',
];
