// What a stored item must look like before a screen gets it. Every saved
// shape since the first release passes; values that are only missing a field
// newer code expects get it filled in (no data changes meaning). Anything a
// screen would crash on returns null, and the loader moves the raw value to
// quarantine instead of handing it out or deleting it.
//
// Pure, so the launch tests run it in Node.

import type { Hand } from '@/poker/types';

import { DEFAULT_SETTINGS, type BackedPlayer, type PlayerNote, type Session, type Settings, type Trip } from './types';

type Obj = Record<string, unknown>;

const isObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isIndex = (x: unknown, n: number) => Number.isInteger(x) && (x as number) >= 0 && (x as number) < n;
const strings = (x: unknown) => Array.isArray(x) && x.every((v) => typeof v === 'string');
const CARD = /^[2-9TJQKA][shdc]$/;
const cards = (x: unknown) => Array.isArray(x) && x.every((v) => typeof v === 'string' && CARD.test(v));

/** Returns `x` itself when nothing was missing, so the caller can tell a repair apart. */
export type Fix<T> = (x: unknown) => T | null;

/** Any list item: an object with an id. */
export function fixItem<T>(x: unknown): T | null {
  return isObj(x) && typeof x.id === 'string' && x.id.length > 0 ? (x as T) : null;
}

const ACTIONS = new Set(['fold', 'check', 'call', 'bet', 'raise']);

export const fixHand: Fix<Hand> = (x) => {
  if (!fixItem(x)) return null;
  const h = x as Obj;
  const g = h.game;
  if (!isObj(g) || !isNum(g.sb) || !isNum(g.bb)) return null;
  const players = h.players;
  if (!Array.isArray(players) || players.length < 2 || !players.every((p) => isObj(p) && isNum(p.stack) && (p.cards === undefined || cards(p.cards)))) return null;
  if (!isIndex(h.hero, players.length) || !isIndex(h.button, players.length)) return null;
  if (h.actions !== undefined && !(Array.isArray(h.actions) && h.actions.every((a) => isObj(a) && isIndex(a.p, players.length) && ACTIONS.has(a.kind as string)))) return null;
  for (const k of ['board', 'board2'] as const) if (h[k] !== undefined && !cards(h[k])) return null;
  for (const k of ['tags', 'folders'] as const) if (h[k] !== undefined && !strings(h[k])) return null;
  if (h.winners !== undefined && !(Array.isArray(h.winners) && h.winners.every((w) => isIndex(w, players.length)))) return null;

  const patch: Obj = {};
  if (h.actions === undefined) patch.actions = [];
  if (h.board === undefined) patch.board = [];
  if (h.tags === undefined) patch.tags = [];
  if (typeof h.notes !== 'string') patch.notes = '';
  if (!isNum(h.createdAt)) patch.createdAt = isNum(h.updatedAt) ? h.updatedAt : 0;
  if (!isNum(h.updatedAt)) patch.updatedAt = patch.createdAt ?? h.createdAt;
  if (typeof g.name !== 'string' || !isNum(g.ante) || typeof g.currency !== 'string' || typeof g.kind !== 'string' || typeof g.anteType !== 'string')
    patch.game = { kind: 'mtt', name: '', ante: 0, anteType: 'none', currency: '€', ...stripBad(g) };
  if (h.v !== 1) patch.v = 1;
  return (Object.keys(patch).length ? { ...h, ...patch } : h) as unknown as Hand;
};

/** Drops the game fields whose type is wrong, so the defaults above take their place. */
function stripBad(g: Obj): Obj {
  const out: Obj = { ...g };
  if (typeof out.name !== 'string') delete out.name;
  if (!isNum(out.ante)) delete out.ante;
  if (typeof out.currency !== 'string') delete out.currency;
  if (out.kind !== 'mtt' && out.kind !== 'cash') delete out.kind;
  if (typeof out.anteType !== 'string') delete out.anteType;
  return out;
}

export const fixSession: Fix<Session> = (x) => {
  if (!fixItem(x)) return null;
  const s = x as Obj;
  if (!isNum(s.startedAt)) return null;
  for (const k of ['breaks', 'stackLog', 'stakes', 'docs', 'tags'] as const) if (s[k] !== undefined && !(Array.isArray(s[k]) && (s[k] as unknown[]).every((v) => k === 'tags' ? typeof v === 'string' : isObj(v)))) return null;
  if (s.roster !== undefined && !Array.isArray(s.roster)) return null;

  const patch: Obj = {};
  if (s.kind !== 'mtt' && s.kind !== 'cash') patch.kind = 'mtt';
  for (const k of ['name', 'venue', 'notes'] as const) if (typeof s[k] !== 'string') patch[k] = '';
  if (typeof s.currency !== 'string' || !s.currency) patch.currency = '€';
  for (const k of ['buyIn', 'addOn', 'cashOut', 'sb', 'bb', 'ante', 'stack'] as const) if (!isNum(s[k])) patch[k] = 0;
  if (!isNum(s.entries)) patch.entries = 1;
  if (!isNum(s.tableSize)) patch.tableSize = 9;
  if (typeof s.anteType !== 'string') patch.anteType = 'none';
  if (s.breaks === undefined) patch.breaks = [];
  if (s.stackLog === undefined) patch.stackLog = [];
  if (s.roster === undefined) patch.roster = [];
  return (Object.keys(patch).length ? { ...s, ...patch } : s) as unknown as Session;
};

/**
 * Settings over the defaults. A field of the wrong type falls back to its
 * default; `bad` says so, so the raw value is kept aside before it is rewritten.
 */
export function fixSettings(x: unknown): { settings: Settings; bad: boolean } {
  if (x === undefined) return { settings: DEFAULT_SETTINGS, bad: false };
  if (!isObj(x)) return { settings: DEFAULT_SETTINGS, bad: true };
  const out: Obj = { ...DEFAULT_SETTINGS, ...x };
  let bad = false;
  for (const [k, def] of Object.entries(DEFAULT_SETTINGS)) {
    if (typeof out[k] !== typeof def) {
      out[k] = def;
      bad = true;
    }
  }
  const optional: Record<string, (v: unknown) => boolean> = {
    bankrollId: (v) => typeof v === 'string',
    hideAmounts: (v) => typeof v === 'boolean',
    streakPauses: (v) => Array.isArray(v) && v.every((p) => isObj(p) && isNum(p.from)),
    sizes: (v) => isObj(v) && Object.values(v).every((m) => isObj(m) && Object.values(m).every((x) => isNum(x) && x > 0)),
  };
  for (const [k, ok] of Object.entries(optional)) {
    if (out[k] !== undefined && !ok(out[k])) {
      delete out[k];
      bad = true;
    }
  }
  return { settings: out as unknown as Settings, bad };
}

export const fixPlayer: Fix<PlayerNote> = (x) => {
  if (!fixItem(x)) return null;
  const p = x as Obj;
  if (p.tags !== undefined && !strings(p.tags)) return null;
  const patch: Obj = {};
  for (const k of ['name', 'look', 'notes'] as const) if (typeof p[k] !== 'string') patch[k] = '';
  if (p.tags === undefined) patch.tags = [];
  return (Object.keys(patch).length ? { ...p, ...patch } : p) as unknown as PlayerNote;
};

export const fixTrip: Fix<Trip> = (x) => {
  if (!fixItem(x)) return null;
  const tr = x as Obj;
  if (!isNum(tr.from) || !isNum(tr.to)) return null;
  if (tr.expenses !== undefined && !(Array.isArray(tr.expenses) && tr.expenses.every(isObj))) return null;
  return (tr.expenses === undefined ? { ...tr, expenses: [] } : tr) as unknown as Trip;
};

export const fixBacked: Fix<BackedPlayer> = (x) => (fixItem(x) && isObj((x as Obj).statement) ? (x as BackedPlayer) : null);
