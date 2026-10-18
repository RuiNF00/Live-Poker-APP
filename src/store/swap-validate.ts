// What a stored swap or group swap must look like before a screen gets it (see validate.ts):
// the fields every swap screen and the settle list read without checking. One that fails
// goes to quarantine at launch instead of crashing the app at the root.

import type { SwapGroup } from './swap-groups';
import { validSwapId, validSwapToken, type Swap } from './swaps';

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isStr = (x: unknown): x is string => typeof x === 'string';
const isSeat = (x: unknown) => Number.isInteger(x) && (x as number) >= 0 && (x as number) < 8;
const party = (x: unknown) => isObj(x) && isStr(x.name) && isNum(x.pct);
const entryBase = (e: unknown): e is Obj => isObj(e) && isStr(e.id) && isStr(e.kind) && isNum(e.amount) && isNum(e.at);
const terms = (x: unknown): x is Obj =>
  isObj(x) && (x.scope === 'event' || x.scope === 'series') && isStr(x.title) && isStr(x.venue) && isStr(x.currency) && isNum(x.createdAt);

export function fixSwap(x: unknown): Swap | null {
  if (!isObj(x) || !validSwapId(x.id) || !validSwapToken(x.token) || (x.side !== 'a' && x.side !== 'b') || !isNum(x.createdAt)) return null;
  if (!terms(x.terms) || !party(x.terms.a) || !party(x.terms.b)) return null;
  if (!Array.isArray(x.entries) || !x.entries.every((e) => entryBase(e) && (e.side === 'a' || e.side === 'b'))) return null;
  return x as unknown as Swap;
}

export function fixSwapGroup(x: unknown): SwapGroup | null {
  if (!isObj(x) || !validSwapId(x.id) || !validSwapToken(x.token) || !isSeat(x.seat) || !isNum(x.createdAt)) return null;
  if (x.invite !== undefined && !validSwapToken(x.invite)) return null;
  if (!terms(x.terms) || !isNum(x.terms.pct)) return null;
  if (!Array.isArray(x.seats) || !x.seats.every((s) => isObj(s) && isSeat(s.seat) && isStr(s.name))) return null;
  if (!Array.isArray(x.entries) || !x.entries.every((e) => entryBase(e) && isSeat(e.seat) && (e.to === undefined || isSeat(e.to)))) return null;
  return x as unknown as SwapGroup;
}
