// The hand as a short vertical video (Reels, TikTok, WhatsApp status): one
// frame per key moment of the replay, each held for a beat, ending on the
// result. Frames are captured from <StoryCard step> on the phone and joined by
// the share server (web/src/app/api/replay-video).

import type { Hand } from '@/poker/types';
import type { Replay } from '@/poker/engine';

export const REEL_MIN_S = 15;
export const REEL_MAX_S = 30;
/** Frames per video. Keeps the upload under the server's 4 MB body limit. */
export const REEL_MAX_FRAMES = 20;
/** The last frame (result) stays up at least this long. */
const END_HOLD_S = 3;

/**
 * Which replay steps become frames. Folds by players other than hero are
 * skipped (the next frame shows them folded anyway); the deal, every street,
 * hero's actions, bets and the end always stay. Long hands are thinned
 * evenly, never dropping a street or the end.
 */
export function reelSteps(hand: Hand, r: Replay, max = REEL_MAX_FRAMES): number[] {
  const last = r.steps.length - 1;
  const keep: number[] = [];
  r.steps.forEach((s, k) => {
    if (k === 0 || k === last || s.kind !== 'action') return keep.push(k);
    const a = s.state.last;
    if (a && a.kind === 'fold' && a.p !== hand.hero) return;
    keep.push(k);
  });
  if (keep.length <= max) return keep;
  const fixed = new Set(keep.filter((k) => k === 0 || k === last || r.steps[k].kind !== 'action'));
  const loose = keep.filter((k) => !fixed.has(k));
  const room = Math.max(0, max - fixed.size);
  const picked = new Set<number>();
  for (let j = 0; j < room; j++) picked.add(loose[Math.floor(((j + 0.5) * loose.length) / room)]);
  return keep.filter((k) => fixed.has(k) || picked.has(k)).slice(-max);
}

/**
 * Seconds each frame stays on screen. A new street gets a longer beat, the
 * result the longest. The whole video lasts 15 to 30 s, and at least as long
 * as the voice note when there is one.
 */
export function reelDurations(r: Replay, steps: number[], voiceSeconds: number | null = null): number[] {
  if (!steps.length) return [];
  const weight = (k: number) => (r.steps[k].kind === 'board' ? 1.5 : r.steps[k].kind === 'start' ? 1.2 : 1);
  const body = steps.slice(0, -1);
  const natural = body.reduce((a, k) => a + weight(k) * 1.1, 0) + END_HOLD_S;
  const total = Math.min(REEL_MAX_S, Math.max(REEL_MIN_S, natural, voiceSeconds ? voiceSeconds + 0.5 : 0));
  if (!body.length) return [round(total)];
  // The end frame takes a fixed share; the rest is spread by weight.
  const end = Math.max(END_HOLD_S, total * 0.18);
  const w = body.reduce((a, k) => a + weight(k), 0);
  const out = body.map((k) => round(((total - end) * weight(k)) / w));
  out.push(round(total - out.reduce((a, d) => a + d, 0)));
  return out;
}

const round = (s: number) => Math.round(s * 100) / 100;
