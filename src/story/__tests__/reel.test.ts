/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { replay } from '../../poker/engine';
import { sampleHand } from '../../poker/sample';
import { motionTimeline } from '../../components/replayer/timeline';
import { REEL_MAX_FRAMES, REEL_MAX_S, REEL_MIN_S, reelFrames, reelSteps } from '../reel';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

test('frames skip other players folding but keep the deal, streets, hero and the end', () => {
  const hand = sampleHand('s');
  const r = replay(hand);
  const steps = reelSteps(hand, r);
  const last = r.steps.length - 1;
  assert.equal(steps[0], 0);
  assert.equal(steps.at(-1), last);
  for (const k of steps) {
    const s = r.steps[k];
    if (s.kind === 'action' && s.state.last?.kind === 'fold') assert.equal(s.state.last.p, hand.hero);
  }
  r.steps.forEach((s, k) => {
    if (s.kind === 'board') assert.ok(steps.includes(k), 'street ' + s.street);
    if (s.kind === 'action' && s.state.last?.p === hand.hero) assert.ok(steps.includes(k), 'hero action ' + k);
  });
  assert.ok(steps.length < r.steps.length);
});

test('long hands are thinned to the frame cap without losing streets or the end', () => {
  const hand = sampleHand('s');
  const r = replay(hand);
  const steps = reelSteps(hand, r, 5);
  assert.ok(steps.length <= 5);
  assert.equal(steps.at(-1), r.steps.length - 1);
  assert.deepEqual([...steps].sort((a, b) => a - b), steps);
});

test('the video lasts 15 to 30 s, covers the voice, and ends on a long hold', () => {
  const hand = sampleHand('s');
  const r = replay(hand);
  const motion = motionTimeline(hand, r);
  const secs = (f: { sec: number }[]) => sum(f.map((x) => x.sec));
  const plain = reelFrames(hand, r, motion);
  assert.ok(plain.length <= REEL_MAX_FRAMES);
  assert.ok(secs(plain) >= REEL_MIN_S - 0.05 && secs(plain) <= REEL_MAX_S + 0.05);
  assert.ok(plain.at(-1)!.sec >= 3);
  assert.equal(plain.at(-1)!.at, undefined);
  assert.ok(plain.every((f) => f.sec > 0));

  assert.ok(secs(reelFrames(hand, r, motion, 24)) >= 24.4);
  assert.ok(secs(reelFrames(hand, r, motion, 90)) <= REEL_MAX_S + 0.05);
});

test("frames follow the replayer's timeline: same proportions, plus mid-animation frames", () => {
  const hand = sampleHand('s');
  const r = replay(hand);
  const motion = motionTimeline(hand, r);
  const frames = reelFrames(hand, r, motion);
  const steps = reelSteps(hand, r);
  // Every kept step is there, in order, at rest at least once.
  assert.deepEqual([...new Set(frames.map((f) => f.k))], steps);
  // The pot going to the winner gets a frame mid-flight, before the final still.
  const end = frames.filter((f) => f.k === r.steps.length - 1);
  assert.equal(end.length, 2);
  assert.ok(end[0].at! > 0 && end[1].at === undefined);
  // A street (held 1.4 beats in the app) stays up longer than an action that stands only for itself.
  const held = (k: number) => frames.filter((f) => f.k === k).reduce((a, f) => a + f.sec, 0);
  const board = steps.find((k) => r.steps[k].kind === 'board')!;
  const lone = steps.find((k, i) => r.steps[k].kind === 'action' && steps[i + 1] === k + 1 && r.steps[k + 1].kind === 'action')!;
  assert.ok(held(board) > held(lone));
  // Under Reduce Motion there are no mid-animation frames, and the timing is the same shape.
  const still = reelFrames(hand, r, motionTimeline(hand, r, { reduce: true }));
  assert.ok(still.every((f) => f.at === undefined));
  assert.equal(still.length, steps.length);
});
