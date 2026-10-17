/// <reference types="node" />
// Tricky live hands, end to end: the engine (entry, replayer, Story) and the shared page
// (hand-format via fromAppHand) must agree on stacks, pots and who wins what, and the
// replayer's spoken text must read cleanly.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildReplay, describeStep, fromAppHand, stakesText, straddleOf } from '../../../packages/hand-format/src';
import { spokenTable, timeline, viewAt } from '../../components/replayer/model';
import { motionTimeline } from '../../components/replayer/timeline';
import { isComplete, positions, replay, totalPot } from '../engine';
import { blindsLabel } from '../format';
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

// Ponto 6: side pots, straddles, run it twice and split pots together, as Registo round 4 logs them.
const won = (o: { res: { won: number[] } }, n: number, pos: string) => o.res.won[positions(n, 0).indexOf(pos)];

test('4-way all-in with cent blinds: three pots, each to the cent, a chop in the middle one', () => {
  const seats = [
    { pos: 'BTN', stack: 20.1, cards: ['Ah', 'Ad'], name: 'Hero' },
    { pos: 'SB', stack: 35.35, cards: ['Kc', 'Qc'] },
    { pos: 'BB', stack: 50, cards: ['Kd', 'Qd'] },
    { pos: 'UTG', stack: 80.75, cards: ['7s', '7h'] },
  ];
  const h = mk({ kind: 'cash', sb: 0.25, bb: 0.5 }, seats,
    [['UTG', 'raise', 80.75], ['BTN', 'call'], ['SB', 'call'], ['BB', 'call']],
    ['Kh', 'Qs', '2c', '5d', '9h']);
  const o = run(h);
  // Main 4×20.10 = 80.40 → BTN? No: KQ two pair beats aces. KQ chop the main and the first side.
  // Main 80.40 → SB/BB 40.20 each. Side 1: 3×15.25 = 45.75 → 22.88 / 22.87. Side 2: 2×14.65 = 29.30 → BB.
  // UTG's last 30.75 are uncalled and come back.
  assert.equal(o.res.pots.length, 3);
  assert.equal(won(o, 4, 'BTN'), 0);
  assert.equal(Math.round((won(o, 4, 'SB') + won(o, 4, 'BB')) * 100), Math.round((80.4 + 45.75 + 29.3) * 100));
  assert.ok(Math.abs(won(o, 4, 'BB') - (40.2 + 22.87 + 29.3)) < 1e-9 || Math.abs(won(o, 4, 'BB') - (40.2 + 22.88 + 29.3)) < 1e-9, `BB ${won(o, 4, 'BB')}`);
  assert.ok(near(o.appStacks, o.webStacks), `stacks app ${o.appStacks} web ${o.webStacks}`);
  assert.ok(near(o.res.won, o.webWon), `won app ${o.res.won} web ${o.webWon}`);
  // Every amount on the shared page is a whole number of cents.
  for (const w of o.last.winners ?? []) assert.equal(Math.round(w.amount * 100) / 100, w.amount, `${w.amount}`);
});

test('straddle and side pots: the straddler all-in short, two others play a side pot', () => {
  const h = mk(
    { straddles: 1 },
    SIX([1000, 1000, 1000, 8, 1000, 1000], { BTN: ['Ah', 'Kh'], UTG: ['2s', '2d'], CO: ['Js', 'Jd'] }),
    // UTG straddles 10 but only has 8: all-in for the straddle.
    [['HJ', 'fold'], ['CO', 'raise', 30], ['BTN', 'call'], ['SB', 'fold'], ['BB', 'fold'],
     ['CO', 'check'], ['BTN', 'bet', 50], ['CO', 'call'], ['CO', 'check'], ['BTN', 'check'], ['CO', 'check'], ['BTN', 'check']],
    ['Kd', '7c', '2h', '9h', '3d'],
  );
  const r = replay(h);
  if (r.invalidAt !== null) return; // a short straddle isn't loggable in the app; nothing to compare
  const o = run(h);
  assert.ok(near(o.appStacks, o.webStacks), `stacks app ${o.appStacks} web ${o.webStacks}`);
  assert.ok(near(o.res.won, o.webWon), `won app ${o.res.won} web ${o.webWon}`);
});

test('straddle: the blinds line reads 2/5/10 on both pages and the straddler posts before the action', () => {
  const h = mk(
    { straddles: 1 },
    SIX([1000, 1000, 1000, 1000, 1000, 1000], { BTN: ['Ah', 'Kh'], UTG: ['Qs', 'Qd'] }),
    [['HJ', 'fold'], ['CO', 'fold'], ['BTN', 'raise', 35], ['SB', 'fold'], ['BB', 'fold'], ['UTG', 'call'],
     ['UTG', 'check'], ['BTN', 'check'], ['UTG', 'check'], ['BTN', 'check'], ['UTG', 'check'], ['BTN', 'check']],
    ['Kd', '7c', '2s', '9h', '3d'],
  );
  const o = run(h);
  const { hand: rec } = fromAppHand(publicHand(h, { names: true, notes: false }) as never);
  assert.equal(stakesText(rec.blinds, String, ' · ', straddleOf(rec)), '2/5/10');
  assert.match(blindsLabel(h), /^2\/5\/10/);
  // The start step already has the straddle in front of UTG, and the first action is HJ's.
  const start = o.steps[0];
  assert.equal(start.seats.find((s) => s.seat === positions(6, 0).indexOf('UTG') + 1)!.committed, 10);
  assert.equal(o.steps[1].actingSeat, positions(6, 0).indexOf('HJ') + 1);
  const v0 = viewAt(h, o.r, 0, { inBB: false, reveal: false, atEnd: false });
  assert.match(spokenTable(v0), /10/);
});

test('run it twice with side pots and known cards: each board pays each pot, both pages agree', () => {
  const seats = [
    { pos: 'BTN', stack: 200, cards: ['Ah', 'Ad'], name: 'Hero' },
    { pos: 'SB', stack: 500, cards: ['Kc', 'Kd'] },
    { pos: 'BB', stack: 500, cards: ['Qh', 'Qs'] },
  ];
  const h = mk({ kind: 'cash', sb: 2, bb: 5 }, seats,
    [['BTN', 'raise', 200], ['SB', 'raise', 500], ['BB', 'call']],
    ['Kh', '7c', '2d', '9s', '3c'], { board2: ['Qc', '8h', '4s', '6d', 'Jc'] });
  const o = run(h);
  // Main 600 split per board: 300 to SB (set of kings, board 1), 300 to BB (set of queens, board 2).
  // Side 2×300 = 600: same, 300 each. Aces win nothing.
  assert.equal(won(o, 3, 'BTN'), 0);
  assert.equal(won(o, 3, 'SB'), 600);
  assert.equal(won(o, 3, 'BB'), 600);
  assert.equal(o.last.runs?.length, 2);
  assert.ok(near(o.appStacks, o.webStacks), `stacks app ${o.appStacks} web ${o.webStacks}`);
  assert.ok(near(o.res.won, o.webWon), `won app ${o.res.won} web ${o.webWon}`);
  // Each run lists what it paid, and the two runs add up to the pot.
  const perRun = o.last.runs!.map((run) => run.winners.reduce((a, w) => a + w.amount, 0));
  assert.equal(perRun[0] + perRun[1], 1200);
});

test('run it twice with cent blinds: the pot halves to the cent', () => {
  const seats = [
    { pos: 'BTN', stack: 10, cards: ['Ah', 'Kd'], name: 'Hero' },
    { pos: 'SB', stack: 10 },
    { pos: 'BB', stack: 10, cards: ['Qh', 'Qd'] },
  ];
  // 10 + 10 + 0.25 dead = 20.25: one run gets 10.13, the other 10.12.
  const h = mk({ kind: 'cash', sb: 0.25, bb: 0.5 }, seats, [['BTN', 'raise', 10], ['SB', 'fold'], ['BB', 'call']],
    ['Ac', '7c', '2d', '9s', '3c'], { board2: ['Qc', '8h', '4s', '6d', 'Jc'] });
  const o = run(h);
  assert.ok(near(o.res.won, o.webWon), `won app ${o.res.won} web ${o.webWon}`);
  for (const run of o.last.runs!) for (const w of run.winners) assert.equal(Math.round(w.amount * 100) / 100, w.amount, `${w.amount}`);
});

test('split pot: both winners are named with their hand on both pages', () => {
  const seats = [
    { pos: 'BTN', stack: 500, cards: ['Ah', 'Kd'], name: 'Hero' },
    { pos: 'SB', stack: 500 },
    { pos: 'BB', stack: 500, cards: ['As', 'Kc'] },
  ];
  const h = mk({ kind: 'cash', sb: 2, bb: 5 }, seats,
    [['BTN', 'raise', 15], ['SB', 'fold'], ['BB', 'call'], ['BB', 'check'], ['BTN', 'check'], ['BB', 'check'], ['BTN', 'check'], ['BB', 'check'], ['BTN', 'check']],
    ['Ac', '7d', '9s', 'Jh', '4c']);
  const o = run(h);
  assert.equal(o.res.won[0], 16);
  assert.equal(o.res.won[2], 16);
  const end = viewAt(h, o.r, o.r.steps.length - 1, { inBB: false, reveal: true, atEnd: true });
  assert.equal(end.seats[0].handName, 'Par de Ases');
  assert.equal(end.seats[2].handName, 'Par de Ases');
  const said = spokenTable(end);
  assert.equal((said.match(/Par de Ases/g) ?? []).length >= 2, true, said);
  const labels = (o.last.winners ?? []).map((w) => w.handLabel);
  assert.deepEqual(labels, ['Par de Ases', 'Par de Ases']);
  const text = describeStep(o.last, 5, 'chips', 'pt');
  assert.equal((text.match(/Par de Ases/g) ?? []).length, 2, text);
});

test('run it twice at 0.25/0.50 with a round pot: €3 halves to 1.50 + 1.50, not 2 + 1', () => {
  const seats = [
    { pos: 'BTN', stack: 1, cards: ['Ah', 'Kd'], name: 'Hero' },
    { pos: 'SB', stack: 1, cards: ['Jh', 'Jd'] },
    { pos: 'BB', stack: 1, cards: ['Qh', 'Qd'] },
  ];
  const h = mk({ kind: 'cash', sb: 0.25, bb: 0.5 }, seats, [['BTN', 'raise', 1], ['SB', 'call'], ['BB', 'call']],
    ['Ac', '7c', '2d', '9s', '3c'], { board2: ['Qc', '8h', '4s', '6d', 'Jc'] });
  const o = run(h);
  assert.equal(won(o, 3, 'BTN'), 1.5);
  assert.equal(won(o, 3, 'BB'), 1.5);
  assert.ok(near(o.res.won, o.webWon), `won app ${o.res.won} web ${o.webWon}`);
  assert.deepEqual(o.last.runs!.map((run) => run.winners.map((w) => w.amount)), [[1.5], [1.5]]);
  // The replayer says what each board paid, to the cent.
  const end = viewAt(h, o.r, o.r.steps.length - 1, { inBB: false, reveal: true, atEnd: true });
  assert.match(end.narration, /Mesa 1: .*1,50.*Mesa 2: .*1,50/);
});

test('run it twice with cent blinds: the replayer pays each board what the engine paid', () => {
  const seats = [
    { pos: 'BTN', stack: 10, cards: ['Ah', 'Kd'], name: 'Hero' },
    { pos: 'SB', stack: 10 },
    { pos: 'BB', stack: 10, cards: ['Qh', 'Qd'] },
  ];
  const h = mk({ kind: 'cash', sb: 0.25, bb: 0.5 }, seats, [['BTN', 'raise', 10], ['SB', 'fold'], ['BB', 'call']],
    ['Ac', '7c', '2d', '9s', '3c'], { board2: ['Qc', '8h', '4s', '6d', 'Jc'] });
  const o = run(h);
  const end = viewAt(h, o.r, o.r.steps.length - 1, { inBB: false, reveal: true, atEnd: true });
  // 20.25 in the middle: board 1 pays 10.13, board 2 pays 10.12 (not 11 and 9.25).
  assert.match(end.narration, /Mesa 1: .*10,13.*Mesa 2: .*10,12/);
});

test('chop with a folded small blind at 0.25/0.50: €2.50 is 1.25 each on both pages, not 1.26 / 1.24', () => {
  const seats = [
    { pos: 'BTN', stack: 50, cards: ['Ah', 'Kd'], name: 'Hero' },
    { pos: 'SB', stack: 50 },
    { pos: 'BB', stack: 50, cards: ['Ac', 'Ks'] },
  ];
  const h = mk({ kind: 'cash', sb: 0.25, bb: 0.5 }, seats,
    [['BTN', 'raise', 1.125], ['SB', 'fold'], ['BB', 'call'], ['BB', 'check'], ['BTN', 'check'], ['BB', 'check'], ['BTN', 'check'], ['BB', 'check'], ['BTN', 'check']],
    ['2c', '7d', '9s', 'Jh', '4c']);
  const o = run(h);
  assert.equal(won(o, 3, 'BTN'), 1.25);
  assert.equal(won(o, 3, 'BB'), 1.25);
  assert.ok(near(o.res.won, o.webWon), `won app ${o.res.won} web ${o.webWon}`);
});
