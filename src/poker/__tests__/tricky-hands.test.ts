/// <reference types="node" />
// Tricky live hands, end to end: the engine (entry, replayer, Story) and the shared page
// (hand-format via fromAppHand) must agree on stacks, pots and who wins what, and the
// replayer's spoken text must read cleanly.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildReplay, describeStep, fromAppHand } from '../../../packages/hand-format/src';
import { spokenTable, timeline, viewAt } from '../../components/replayer/model';
import { motionTimeline } from '../../components/replayer/timeline';
import { isComplete, positions, replay, totalPot } from '../engine';
import { pokerStarsText } from '../pokerstars';
import { publicHand } from '../privacy';
import type { GameInfo, Hand, HandAction } from '../types';

const CASH: GameInfo = { kind: 'cash', name: '2/5', sb: 2, bb: 5, ante: 0, anteType: 'none', currency: '€' };

/** Players by position label (button on seat 0); stacks and cards by label too. */
function mk(
  game: Partial<GameInfo>,
  seats: { pos: string; stack: number; cards?: string[]; name?: string }[],
  line: [string, HandAction['kind'], number?][],
  board: string[],
  over: Partial<Hand> = {},
): Hand {
  const n = seats.length;
  const pos = positions(n, 0);
  const players = pos.map((l) => {
    const s = seats.find((x) => x.pos === l)!;
    return { name: s.name ?? '', stack: s.stack, cards: s.cards };
  });
  const hero = pos.indexOf(seats.find((s) => s.name === 'Hero')?.pos ?? pos[0]);
  return {
    v: 1, id: 'x', createdAt: 0, updatedAt: 0, game: { ...CASH, ...game }, players, button: 0, hero,
    actions: line.map(([l, kind, to]) => ({ p: pos.indexOf(l), kind, to })),
    board, tags: [], notes: '', ...over,
  };
}

function run(hand: Hand) {
  const r = replay(hand);
  assert.equal(r.invalidAt, null, 'every action applies');
  assert.ok(isComplete(hand), 'hand is complete');
  const res = r.result!;
  assert.ok(res, 'hand has a result');
  // Engine: chips in = chips out, to the cent.
  const start = hand.players.reduce((a, p) => a + p.stack, 0);
  const end = r.final.stacks.reduce((a, b) => a + b, 0) + res.won.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(start - end) < 1e-9, `chips conserved (${start} vs ${end})`);
  assert.ok(Math.abs(res.won.reduce((a, b) => a + b, 0) - res.pots.reduce((a, b) => a + b.amount, 0)) < 1e-9, 'pots paid in full');

  // Shared page: same hand after the privacy filter and the conversion.
  const { hand: rec } = fromAppHand(publicHand(hand, { names: true, notes: false }) as never);
  const steps = buildReplay(rec);
  const last = steps[steps.length - 1];
  const webWon = hand.players.map((_, i) => last.winners?.filter((w) => w.seat === i + 1).reduce((a, w) => a + w.amount, 0) ?? 0);
  const webStacks = hand.players.map((_, i) => last.seats.find((s) => s.seat === i + 1)!.stack);
  const appStacks = r.final.stacks.map((s, i) => s + res.won[i]);

  // Replayer and Story: every step draws and reads; the timeline has one motion per step.
  const motion = motionTimeline(hand, r);
  assert.equal(motion.length, r.steps.length);
  for (let k = 0; k < r.steps.length; k++) {
    const v = viewAt(hand, r, k, { inBB: true, reveal: false, atEnd: k === r.steps.length - 1 });
    const said = spokenTable(v);
    assert.doesNotMatch(said, /undefined|NaN|null|apost/i, `step ${k}: ${said}`);
  }
  for (const it of timeline(hand, r, true)) assert.doesNotMatch(it.spoken, /undefined|NaN|apost/i);
  for (const s of steps) assert.doesNotMatch(describeStep(s, rec.blinds.bb, 'chips', 'pt'), /undefined|NaN/);
  // Solver / tracker export: what the hand history says was collected is what the engine paid.
  const hh = pokerStarsText(hand, r);
  const collected = [...hh.matchAll(/collected [^\d\s(]?([\d.,]+) from/g)].reduce((a, m) => a + Number(m[1].replace(/,/g, '')), 0);
  assert.ok(Math.abs(collected - res.won.reduce((a, b) => a + b, 0)) < 1e-9, `hand history collects ${collected}`);
  return { r, res, steps, last, webWon, webStacks, appStacks, totalPot: totalPot(r.final) };
}

const near = (a: number[], b: number[]) => a.every((x, i) => Math.abs(x - b[i]) < 1e-9);

const SIX = (stacks: number[], cards: Record<string, string[]> = {}, hero = 'BTN') =>
  ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'].map((pos, i) => ({ pos, stack: stacks[i], cards: cards[pos], name: pos === hero ? 'Hero' : '' }));

test('UTG straddle: HJ raises, straddler calls, showdown on the river', () => {
  const h = mk(
    { straddles: 1 },
    SIX([1000, 1000, 1000, 1000, 1000, 1000], { BTN: ['Ah', 'Kh'], UTG: ['Qs', 'Qd'] }),
    [['HJ', 'fold'], ['CO', 'fold'], ['BTN', 'raise', 35], ['SB', 'fold'], ['BB', 'fold'], ['UTG', 'call'],
     ['UTG', 'check'], ['BTN', 'bet', 40], ['UTG', 'call'], ['UTG', 'check'], ['BTN', 'check'], ['UTG', 'check'], ['BTN', 'check']],
    ['Kd', '7c', '2s', '9h', '3d'],
  );
  const o = run(h);
  // Pot: 2 + 5 + 35 + 35 + 40 + 40 = 157, all to the button (kings).
  assert.equal(o.res.won[0], 157);
  assert.ok(near(o.appStacks, o.webStacks), `stacks app ${o.appStacks} web ${o.webStacks}`);
  assert.ok(near(o.res.won, o.webWon), `won app ${o.res.won} web ${o.webWon}`);
});

test('button ante (tournament): only the button pays it, and the shared page counts it', () => {
  const h = mk(
    { kind: 'mtt', name: 'Main', sb: 100, bb: 200, ante: 200, anteType: 'btn' },
    SIX([10000, 10000, 10000, 10000, 10000, 10000], { BTN: ['As', 'Ad'], BB: ['Kc', 'Ks'] }),
    [['UTG', 'fold'], ['HJ', 'fold'], ['CO', 'fold'], ['BTN', 'raise', 500], ['SB', 'fold'], ['BB', 'call'],
     ['BB', 'check'], ['BTN', 'check'], ['BB', 'check'], ['BTN', 'check'], ['BB', 'check'], ['BTN', 'check']],
    ['2c', '7d', '9s', 'Jh', '4c'],
  );
  const o = run(h);
  assert.equal(o.res.won[0], 200 + 100 + 500 + 500, 'ante + SB + both raises');
  assert.ok(near(o.appStacks, o.webStacks), `stacks app ${o.appStacks} web ${o.webStacks}`);
  assert.ok(near(o.res.won, o.webWon), `won app ${o.res.won} web ${o.webWon}`);
});

test('BB ante (tournament): the big blind posts it as dead money', () => {
  const h = mk(
    { kind: 'mtt', name: 'Main', sb: 100, bb: 200, ante: 200, anteType: 'bb' },
    SIX([10000, 10000, 10000, 10000, 10000, 10000], { CO: ['Th', 'Tc'], BB: ['Ac', '5c'] }, 'CO'),
    [['UTG', 'fold'], ['HJ', 'fold'], ['CO', 'raise', 450], ['BTN', 'fold'], ['SB', 'fold'], ['BB', 'call'],
     ['BB', 'check'], ['CO', 'bet', 600], ['BB', 'fold']],
    ['Kd', '8s', '3h'],
  );
  const o = run(h);
  assert.equal(o.res.won[5], 200 + 100 + 450 + 450, 'ante + SB + both raises; the uncalled 600 goes back to the stack');
  assert.equal(o.appStacks[5], 10000 - 450 + 1200);
  assert.ok(near(o.appStacks, o.webStacks), `stacks app ${o.appStacks} web ${o.webStacks}`);
});

test('3-way all-in with two side pots: short stack takes the main, middle the first side, deep the rest', () => {
  const seats = [
    { pos: 'BTN', stack: 300, cards: ['Kh', 'Kd'], name: 'Hero' },
    { pos: 'SB', stack: 100, cards: ['Ah', 'Ad'] },
    { pos: 'BB', stack: 600, cards: ['Qc', 'Qs'] },
  ];
  const h = mk({ kind: 'cash', sb: 1, bb: 2 }, seats, [['BTN', 'raise', 300], ['SB', 'call'], ['BB', 'call']], ['2c', '7d', '9s', 'Jh', '4c']);
  const o = run(h);
  assert.equal(o.res.pots.length, 2, 'main + side pot; BB\'s uncalled 300 is not a pot');
  // Main 3×100 → SB (aces). Side 1: 2×200 → BTN (kings). Side 2: nobody to contest; BB's 300 come back.
  const won = (pos: string) => o.res.won[positions(3, 0).indexOf(pos)];
  assert.equal(won('SB'), 300);
  assert.equal(won('BTN'), 400);
  assert.ok(near(o.appStacks, o.webStacks), `stacks app ${o.appStacks} web ${o.webStacks}`);
  assert.ok(near(o.res.won, o.webWon), `won app ${o.res.won} web ${o.webWon}`);
});

test('run it twice: each board pays half, and both pages agree', () => {
  const seats = [
    { pos: 'BTN', stack: 500, cards: ['As', 'Ks'], name: 'Hero' },
    { pos: 'SB', stack: 500 },
    { pos: 'BB', stack: 500, cards: ['Qh', 'Qd'] },
  ];
  const h = mk({ kind: 'cash', sb: 2, bb: 5 }, seats, [['BTN', 'raise', 500], ['SB', 'fold'], ['BB', 'call']], ['Ah', '7c', '2d', '9s', '3c'], { board2: ['Qc', '8h', '4s', '6d', 'Jc'] });
  const o = run(h);
  // 1002 in the middle: board 1 to AK (pair of aces), board 2 to QQ (set).
  assert.equal(o.res.won[0], 501);
  assert.equal(o.res.won[2], 501);
  assert.ok(o.last.runs?.length === 2, 'the shared page draws two boards');
  assert.ok(near(o.appStacks, o.webStacks), `stacks app ${o.appStacks} web ${o.webStacks}`);
});

test('chop with cent blinds: €1.25 splits 0.63 / 0.62 on both pages', () => {
  const seats = [
    { pos: 'BTN', stack: 50, cards: ['Ah', 'Kd'], name: 'Hero' },
    { pos: 'SB', stack: 50 },
    { pos: 'BB', stack: 50, cards: ['Ac', 'Ks'] },
  ];
  const h = mk({ kind: 'cash', sb: 0.25, bb: 0.5 }, seats,
    [['BTN', 'raise', 0.5], ['SB', 'fold'], ['BB', 'check'], ['BB', 'check'], ['BTN', 'check'], ['BB', 'check'], ['BTN', 'check'], ['BB', 'check'], ['BTN', 'check']],
    ['2c', '7d', '9s', 'Jh', '4c']);
  const o = run(h);
  assert.deepEqual([...o.res.won].sort(), [0, 0.62, 0.63].sort());
  assert.ok(near(o.appStacks, o.webStacks), `stacks app ${o.appStacks} web ${o.webStacks}`);
  assert.ok(near(o.res.won, o.webWon), `won app ${o.res.won} web ${o.webWon}`);
});

test('mucked at showdown: the loser shows nothing, the picked winner takes it', () => {
  const seats = [
    { pos: 'BTN', stack: 1000, cards: ['Jh', 'Jd'], name: 'Hero' },
    { pos: 'SB', stack: 1000 },
    { pos: 'BB', stack: 1000 },
  ];
  const h = mk({ kind: 'cash', sb: 2, bb: 5 }, seats,
    [['BTN', 'raise', 15], ['SB', 'fold'], ['BB', 'call'], ['BB', 'check'], ['BTN', 'bet', 20], ['BB', 'call'], ['BB', 'check'], ['BTN', 'check'], ['BB', 'check'], ['BTN', 'check']],
    ['2c', '7d', '9s', 'Th', '4c'], { winners: [0] });
  const o = run(h);
  assert.equal(o.res.won[0], 2 + 15 + 15 + 20 + 20);
  assert.ok(near(o.appStacks, o.webStacks), `stacks app ${o.appStacks} web ${o.webStacks}`);
  assert.ok(near(o.res.won, o.webWon), `won app ${o.res.won} web ${o.webWon}`);
  const end = viewAt(h, o.r, o.r.steps.length - 1, { inBB: false, reveal: true, atEnd: true });
  assert.equal(end.seats[2].cards, null, 'the mucked hand stays face down even with "show cards"');
});

test('hero folds preflop with the hand shown: the others play on, hero just loses the blind', () => {
  const seats = [
    { pos: 'BTN', stack: 1000, cards: ['8s', '8c'] },
    { pos: 'SB', stack: 1000, cards: ['7h', '2d'], name: 'Hero' },
    { pos: 'BB', stack: 1000, cards: ['Ad', 'Qd'] },
  ];
  const h = mk({ kind: 'cash', sb: 2, bb: 5 }, seats,
    [['BTN', 'raise', 15], ['SB', 'fold'], ['BB', 'call'], ['BB', 'check'], ['BTN', 'check'], ['BB', 'check'], ['BTN', 'check'], ['BB', 'check'], ['BTN', 'check']],
    ['Kc', '9d', '4h', '3s', '2c']);
  const o = run(h);
  assert.equal(o.res.net[1], -2, 'hero loses only the small blind');
  assert.ok(near(o.appStacks, o.webStacks), `stacks app ${o.appStacks} web ${o.webStacks}`);
  assert.ok(near(o.res.won, o.webWon), `won app ${o.res.won} web ${o.webWon}`);
  const end = viewAt(h, o.r, o.r.steps.length - 1, { inBB: false, reveal: false, atEnd: true });
  assert.equal(end.seats[1].folded, true);
});
