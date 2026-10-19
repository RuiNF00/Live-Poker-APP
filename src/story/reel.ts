// The hand as a short vertical video (Reels, TikTok, WhatsApp status): one
// frame per key moment of the replay, timed by the replayer's own motion
// timeline, ending on the result. Frames are captured from <StoryCard step>
// on the phone and joined by the share server (web/src/app/api/replay-video).

import type { Hand } from '@/poker/types';
import type { MotionStep } from '@/components/replayer/timeline';
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

/** One frame of the video: replay step `k`, `at` ms into its animations (none: the step at rest), held `sec` seconds. */
export interface ReelFrame {
  k: number;
  at?: number;
  sec: number;
}

/** When a step's animations are all done, in ms. */
const animEnd = (m: MotionStep) => m.anims.reduce((a, x) => Math.max(a, x.start + x.dur), 0);

/**
 * The frames of the video and how long each stays up, from the same motion
 * timeline the in-app replayer plays (replayer/timeline.ts): a kept step holds
 * for every step it stands in for, then the whole video is scaled to 15–30 s
 * (and the voice note) so the beats keep the replayer's proportions. While
 * there's room under the frame cap, a step whose arrival animates (the pot
 * going to the winner first, then new streets, then bets swept in) also gets a
 * frame mid-animation, held for as long as the animation runs.
 */
export function reelFrames(hand: Hand, r: Replay, motion: MotionStep[], voiceSeconds: number | null = null, max = REEL_MAX_FRAMES): ReelFrame[] {
  const steps = reelSteps(hand, r, max);
  if (!steps.length) return [];
  const last = steps.length - 1;
  // Natural hold of each kept step, in ms: its own beat plus the beats of the steps it skips over.
  const hold = steps.map((k, i) => {
    const to = i < last ? steps[i + 1] : k + 1;
    let ms = 0;
    for (let j = k; j < to; j++) ms += motion[j]?.ms ?? 0;
    return ms;
  });
  const rank = (k: number) => (k === steps[last] ? 0 : r.steps[k].kind === 'board' ? 1 : 2);
  const spare = Math.max(0, max - steps.length);
  const moving = new Set(
    steps
      .filter((k) => (motion[k]?.anims.length ?? 0) > 0)
      .sort((a, b) => rank(a) - rank(b) || a - b)
      .slice(0, spare),
  );
  const raw: { k: number; at?: number; ms: number }[] = [];
  steps.forEach((k, i) => {
    const m = motion[k];
    if (m && moving.has(k)) {
      const end = Math.min(animEnd(m), hold[i] - 1);
      raw.push({ k, at: Math.round(end / 2), ms: end });
      raw.push({ k, ms: hold[i] - end });
    } else raw.push({ k, ms: hold[i] });
  });

  const natural = raw.reduce((a, f) => a + f.ms, 0) / 1000;
  const total = Math.min(REEL_MAX_S, Math.max(REEL_MIN_S, natural, voiceSeconds ? voiceSeconds + 0.5 : 0));
  if (raw.length === 1) return [{ k: raw[0].k, sec: round(total) }];
  // The result stays up long enough to read; the rest keeps the timeline's proportions.
  const end = Math.max(END_HOLD_S, (raw[raw.length - 1].ms / 1000) * (total / natural));
  const body = raw.slice(0, -1);
  const bodyMs = body.reduce((a, f) => a + f.ms, 0);
  const out: ReelFrame[] = body.map((f) => ({ k: f.k, ...(f.at !== undefined ? { at: f.at } : null), sec: round(((total - end) * f.ms) / bodyMs) }));
  out.push({ k: raw[raw.length - 1].k, sec: round(total - out.reduce((a, f) => a + f.sec, 0)) });
  return out;
}

const round = (s: number) => Math.round(s * 100) / 100;
