// Tournament mode inside a live session: the blind structure, the field and
// the payouts the player keeps next to the table. All pure and offline; the
// state lives on the session (Session.tourney).

import { MTT_LEVELS } from './factory';
import type { AnteType } from './types';

export interface Level {
  sb: number;
  bb: number;
  ante: number;
  /** Level length in minutes. */
  minutes: number;
}

export interface Tourney {
  /** Blind levels in order; level n of the session is structure[n - 1]. */
  structure?: Level[];
  /** Name of the template picked, when it came from one. */
  structureName?: string;
  /** Total entries (re-entries included), players left and starting stack: for the average stack. */
  entries?: number;
  left?: number;
  startStack?: number;
  /** Prize for each place, 1st first. */
  payouts?: number[];
}

/** Generic structures to start from: the app's blind ladder with a big-blind ante, at common level lengths. */
export const TEMPLATES: { id: string; minutes: number }[] = [
  { id: 'turbo', minutes: 15 },
  { id: 'standard', minutes: 30 },
  { id: 'deep', minutes: 40 },
  { id: 'highroller', minutes: 60 },
];

export function templateStructure(minutes: number): Level[] {
  return MTT_LEVELS.map(([sb, bb]) => ({ sb, bb, ante: bb, minutes }));
}

const num = (s: string) => Number(s.replace(/[^\d.]/g, '')) * (/k$/i.test(s.trim()) ? 1000 : 1);

/**
 * A structure typed or pasted one level per line: "100/200/200 30",
 * "100-200 (200) 30m", "1  100/200  200  30". Lines without blinds (breaks,
 * headers) are skipped; a missing length repeats the one before.
 */
export function parseStructure(text: string, defaultMinutes = 30): Level[] {
  const out: Level[] = [];
  let minutes = defaultMinutes;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const m = line.match(/(\d[\d,.]*k?)\s*[/-]\s*(\d[\d,.]*k?)(?:\s*[/-]\s*(\d[\d,.]*k?))?/i);
    if (!m) continue;
    const sb = num(m[1].replace(/,/g, ''));
    const bb = num(m[2].replace(/,/g, ''));
    if (!(sb > 0 && bb >= sb)) continue;
    const rest = line.slice((m.index ?? 0) + m[0].length);
    const nums = [...rest.matchAll(/(\d[\d,.]*k?)\s*(m(?:in)?\b|')?/gi)];
    let ante = m[3] ? num(m[3].replace(/,/g, '')) : 0;
    // After the blinds: an ante (if not given with a slash) and the length, which is the last small number or the one marked "m".
    const marked = nums.find((x) => x[2]);
    const lengthTok = marked ?? (nums.length && num(nums[nums.length - 1][1]) <= 120 ? nums[nums.length - 1] : undefined);
    if (lengthTok) minutes = num(lengthTok[1]);
    if (!m[3]) {
      const a = nums.find((x) => x !== lengthTok);
      if (a) ante = num(a[1].replace(/,/g, ''));
    }
    out.push({ sb, bb, ante, minutes });
  }
  return out;
}

/** Payouts typed or pasted: "1 250,000", "2: 150000", "10-12 15,000" (a range pays each place the same). */
export function parsePayouts(text: string): number[] {
  const out: number[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.trim().match(/^(\d+)(?:\s*(?:st|nd|rd|th|º|ª|\.)?)?\s*(?:[-–]\s*(\d+)(?:\s*(?:st|nd|rd|th|º|ª))?)?\s*[:=\t ]\s*[^\d]*([\d][\d,. ]*k?)/i);
    if (!m) continue;
    const from = Number(m[1]);
    const to = m[2] ? Number(m[2]) : from;
    const amount = num(m[3].replace(/[, ]/g, ''));
    if (!(from >= 1 && to >= from && to <= 10000 && amount > 0)) continue;
    for (let p = from; p <= to; p++) out[p - 1] = amount;
  }
  // Holes (a place not listed) pay what the place below pays.
  for (let i = out.length - 2; i >= 0; i--) if (out[i] === undefined) out[i] = out[i + 1];
  return out;
}

/** Big blinds and the M ratio (stack over one orbit's cost: blinds plus antes at this table). */
export function stackDepth(stack: number, g: { sb: number; bb: number; ante: number; anteType: AnteType }, tableSize: number) {
  const antes = g.anteType === 'all' ? g.ante * tableSize : g.ante;
  const orbit = g.sb + g.bb + antes;
  return { bb: g.bb > 0 ? stack / g.bb : 0, m: orbit > 0 ? stack / orbit : 0 };
}

export function averageStack(t: Tourney): number | null {
  if (!t.entries || !t.left || !t.startStack || t.left > t.entries) return null;
  return (t.entries * t.startStack) / t.left;
}

export interface PayState {
  paid: number;
  /** Players to bust before the money (0 once in it). */
  toMoney: number;
  /** What finishing now would pay (0 outside the money), and the first place that pays more. */
  now: number;
  next: number | null;
  /** Players to bust before that next jump. */
  toNext: number | null;
}

export function payState(payouts: number[], left: number): PayState | null {
  const paid = payouts.length;
  if (!paid || left < 1) return null;
  const at = (place: number) => (place <= paid ? payouts[place - 1] : 0);
  const now = at(left);
  let k = Math.min(left - 1, paid);
  while (k >= 1 && at(k) <= now) k--;
  return {
    paid,
    toMoney: Math.max(0, left - paid),
    now,
    next: k >= 1 ? at(k) : null,
    toNext: k >= 1 ? left - k : null,
  };
}

/** Blinds for session level `level` (1-based) on this structure, clamped to its ends. */
export function levelOf(structure: Level[], level: number): Level {
  return structure[Math.max(0, Math.min(structure.length - 1, level - 1))];
}

/** Started the level so that `minutesLeft` remain on it now: the one-tap sync with the floor's clock. */
export function syncedLevelStart(levelMinutes: number, minutesLeft: number, now = Date.now()): number {
  return now - Math.max(0, levelMinutes - minutesLeft) * 60_000;
}

/**
 * Level `level` of the structure, with `minutesLeft` on the floor's clock (the
 * full length when not given): what the session saves, in one go, so the
 * blinds, the level length and the level clock all follow the tournament.
 */
export function syncTo(structure: Level[], level: number, minutesLeft?: number, now = Date.now()) {
  const n = Math.max(1, Math.min(structure.length, level));
  const l = levelOf(structure, n);
  const left = minutesLeft === undefined ? l.minutes : Math.max(0, Math.min(l.minutes, minutesLeft));
  return { sb: l.sb, bb: l.bb, ante: l.ante, level: n, levelMinutes: l.minutes, levelStartedAt: syncedLevelStart(l.minutes, left, now) };
}
