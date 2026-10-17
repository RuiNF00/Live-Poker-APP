/// <reference types="node" />
// Tap budget for the hand-entry screen. A small driver plays the same moves the
// screen offers (position + cards, presets, "só X paga", a tap on a seat the
// app folded by itself ("alguém entrou?"),
// "todos check", board cards, save) and counts one tap per press, so a change
// that makes the common hands slower fails here.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buttonForHeroPosition, legal, positions, replay } from '../engine';
import { autoFold, callerCandidates, checkAround, onlyCaller, rewindTo, sizePresets, skipTo } from '../entry';
import { nextLevel } from '../factory';
import type { Hand, HandAction } from '../types';

function mk(heroPos: string, heroCards: string[], n = 9): Hand {
  const players = Array.from({ length: n }, (_, i) => ({ name: i ? '' : 'Hero', stack: 20000, cards: i ? undefined : heroCards }));
  return {
    v: 1, id: 't', createdAt: 0, updatedAt: 0,
    game: { kind: 'mtt', name: 'T', sb: 100, bb: 200, ante: 200, anteType: 'bb', currency: '€' },
    players, button: buttonForHeroPosition(n, 0, heroPos), hero: 0, actions: [], board: [], tags: [], notes: '',
  };
}

/** Mirrors hand/new.tsx: every press is one tap, automatic folds are free. */
class Entry {
  hand: Hand;
  taps = 3; // position + two hole cards
  autoFrom?: number;
  private done = new Set<string>();
  private history: { hand: Hand; autoFrom?: number }[] = [];

  constructor(heroPos: string, heroCards: string[]) {
    this.hand = mk(heroPos, heroCards);
    this.settle();
  }
  get s() {
    return replay(this.hand).final;
  }
  seat(label: string) {
    const i = positions(this.hand.players.length, this.hand.button).indexOf(label);
    assert.ok(i >= 0, label);
    return i;
  }
  private key() {
    return this.hand.actions.map((a) => `${a.p}${a.kind[0]}${a.to ?? ''}`).join(',');
  }
  private set(actions: HandAction[]) {
    this.history.push({ hand: this.hand, autoFrom: this.autoFrom });
    this.hand = { ...this.hand, actions };
    this.autoFrom = undefined;
    this.settle();
  }
  private settle() {
    const s = this.s;
    const len = this.hand.actions.length;
    if (s.needsBoard || s.toAct === null || this.done.has(this.key())) return;
    const acts = autoFold(this.hand, s);
    if (!acts.length) return;
    this.done.add(this.key());
    this.history.push({ hand: this.hand, autoFrom: this.autoFrom });
    this.hand = { ...this.hand, actions: [...this.hand.actions, ...acts] };
    this.autoFrom = len;
  }
  private push(acts: HandAction[]) {
    assert.ok(acts.length, 'shortcut not offered');
    this.taps++;
    this.set([...this.hand.actions, ...acts]);
  }
  act(kind: HandAction['kind']) {
    this.push([{ p: this.s.toAct!, kind }]);
  }
  size(label: string) {
    const s = this.s;
    const p = sizePresets(this.hand, s).find((x) => x.label === label);
    assert.ok(p, `no preset ${label}`);
    this.push([{ p: s.toAct!, kind: legal(s)!.canBet ? 'bet' : 'raise', to: p.to }]);
  }
  only(label: string | null) {
    const target = label === null ? null : this.seat(label);
    if (target !== null) assert.ok(callerCandidates(this.hand, this.s).includes(target));
    this.push(onlyCaller(this.hand, this.s, target));
  }
  entered(label: string) {
    assert.notEqual(this.autoFrom, undefined, '"alguém entrou?" not shown');
    const actions = rewindTo(this.hand, this.autoFrom!, this.seat(label));
    assert.ok(actions);
    this.taps++;
    this.set(actions);
  }
  skip(label: string) {
    const target = label === 'Hero' ? this.hand.hero : this.seat(label);
    this.push(skipTo(this.hand, this.s, target));
  }
  checkAround() {
    this.push(checkAround(this.hand, this.s));
  }
  board(...cards: string[]) {
    assert.ok(this.s.needsBoard);
    this.taps += cards.length;
    this.hand = { ...this.hand, board: [...this.hand.board, ...cards] };
    this.settle();
  }
  shows(label: string, cards: string[]) {
    // Heads-up showdown: the picker is already open, two taps.
    this.taps += 2;
    this.hand = { ...this.hand, players: this.hand.players.map((p, i) => (i === this.seat(label) ? { ...p, cards } : p)) };
  }
  undo() {
    const prev = this.history.pop()!;
    this.taps++;
    this.hand = prev.hand;
    this.autoFrom = prev.autoFrom;
  }
  save() {
    this.taps++;
    return replay(this.hand);
  }
  /** "Voz" then "Parar e guardar": the hand is kept as it is, with the note. */
  saveWithVoice(file: string) {
    this.taps += 2;
    this.hand = { ...this.hand, voiceNote: file };
    return replay(this.hand);
  }
}

test('the typical hand (open, call, c-bet, fold) stays within the goal of 12 taps', () => {
  for (const [caller, taps] of [['BTN', 11], ['BB', 12]] as const) {
    const e = new Entry('CO', ['Ah', 'Kd']);
    e.size('2.2x');
    e.only(caller);
    e.board('Kc', '8d', '3s');
    if (caller === 'BB') e.act('check');
    e.size('33%');
    e.act('fold');
    const r = e.save();
    assert.equal(e.taps, taps, caller);
    assert.equal(r.final.foldWin, true);
  }
});

test('guardar rápido: position, cards and a voice note save the hand in 5 taps', () => {
  const e = new Entry('HJ', ['9s', '9h']);
  const r = e.saveWithVoice('file:///voice/t.m4a');
  assert.equal(e.taps, 5);
  assert.equal(e.hand.voiceNote, 'file:///voice/t.m4a');
  assert.equal(r.final.toAct, 0, 'reopens at hero, ready to complete');
});

test('single-raised pot: hero opens CO, BTN calls, c-bet called, gives up on the turn — 15 taps', () => {
  const e = new Entry('CO', ['As', 'Qd']);
  assert.equal(e.s.toAct, 0, 'folds to hero by themselves');
  e.size('2.2x');
  e.only('BTN');
  e.board('Kh', '7c', '2d');
  e.size('33%');
  e.only('BTN');
  e.board('9s');
  e.act('check');
  e.size('50%');
  e.act('fold');
  const r = e.save();
  assert.equal(e.taps, 15);
  assert.equal(r.final.foldWin, true);
});

test('3-bet pot: HJ opens, hero 3-bets on the BTN, HJ calls and folds the flop — 14 taps (was 16)', () => {
  const e = new Entry('BTN', ['Qs', 'Qc']);
  e.entered('HJ');
  e.size('2.5x');
  assert.equal(e.s.toAct, 0, 'CO folds by itself after the open');
  e.size('3x');
  e.only('HJ');
  e.board('Jh', '8c', '3d');
  e.act('check');
  e.size('33%');
  e.act('fold');
  const r = e.save();
  assert.equal(e.taps, 14);
  assert.equal(r.final.foldWin, true);
  assert.equal(r.result!.net[0] > 0, true);
});

test('multiway: UTG opens, LJ calls, hero calls on the BTN, blinds fold — 16 taps (was 17)', () => {
  const e = new Entry('BTN', ['8h', '7h']);
  e.entered('UTG');
  e.size('2.5x');
  e.entered('LJ');
  e.act('call');
  assert.equal(e.s.toAct, 0);
  e.act('call');
  e.only(null); // blinds fold: "todos fold" now also after hero calls
  assert.equal(e.s.folded.filter((f) => !f).length, 3);
  e.board('9h', '6c', '2h');
  e.skip('Hero');
  e.size('50%');
  e.only(null);
  const r = e.save();
  assert.equal(e.taps, 16);
  assert.equal(r.final.foldWin, true);
});

test('preflop all-in: CO opens, hero shoves the BTN, CO calls and shows — 15 taps (was 18)', () => {
  const e = new Entry('BTN', ['Ah', 'Ad']);
  e.entered('CO');
  e.size('2.5x');
  e.size('All-in');
  e.only('CO');
  assert.equal(e.s.bettingDone, true);
  e.board('Kc', '7d', '2s');
  e.board('4h');
  e.board('9c');
  e.shows('CO', ['Ks', 'Kd']);
  const r = e.save();
  assert.equal(e.taps, 15);
  assert.equal(r.result!.resolved, true);
  assert.deepEqual(r.result!.pots[0].winners, [e.seat('CO')]);
});

test('hero in the BB: CO opens, hero defends, turn checks through, hero bets the river — 18 taps (was 21)', () => {
  const e = new Entry('BB', ['Jd', 'Td']);
  assert.equal(e.s.toAct, e.seat('SB'), 'auto-fold stops at the SB, no walk for hero');
  e.entered('CO');
  e.size('2.5x');
  assert.equal(e.s.toAct, 0, 'BTN and SB fold by themselves');
  e.act('call');
  e.board('Qd', '9s', '4c');
  e.act('check');
  e.size('33%');
  e.act('call');
  e.board('2h');
  e.checkAround();
  e.board('3s');
  e.size('50%');
  e.act('fold');
  const r = e.save();
  assert.equal(e.taps, 18);
  assert.equal(r.final.foldWin, true);
});

test('after undo, a different line of the same length still folds to hero', () => {
  const e = new Entry('BTN', ['Ah', 'Qh']);
  e.entered('UTG+1');
  e.size('2.2x');
  assert.equal(e.s.toAct, 0);
  e.undo(); // auto-folds after the open
  e.undo(); // the open
  e.undo(); // the rewind: back to the first auto-fold
  e.entered('UTG');
  e.size('2.2x');
  assert.equal(e.s.toAct, 0);
  e.entered('UTG+1');
  e.act('call');
  assert.equal(e.s.toAct, 0, 'the seats after the caller fold by themselves');
});

test('auto-fold stops when the user folds seats by hand', () => {
  const h = mk('BTN', ['As', 'Ks']);
  const h2 = { ...h, actions: [{ p: positions(9, h.button).indexOf('UTG'), kind: 'fold' as const }] };
  assert.deepEqual(autoFold(h2, replay(h2).final), []);
});

test('auto-fold never runs after hero acted', () => {
  let h = mk('CO', ['As', 'Ks']);
  h = { ...h, actions: [...skipTo(h, replay(h).final, 0), { p: 0, kind: 'call' }] };
  assert.deepEqual(autoFold(h, replay(h).final), []);
});

test('rewind keeps the seats before the entrant folded and refuses seats outside the batch', () => {
  let h = mk('BTN', ['As', 'Ks']);
  h = { ...h, actions: autoFold(h, replay(h).final) };
  const pos = positions(9, h.button);
  const lj = pos.indexOf('LJ');
  const back = rewindTo(h, 0, lj)!;
  assert.equal(back.length, 3); // UTG, UTG+1, UTG+2 folded
  assert.equal(replay({ ...h, actions: back }).final.toAct, lj);
  assert.equal(rewindTo(h, 0, pos.indexOf('SB')), null);
});

test('todos check is only offered when nobody has bet and more than one player checks', () => {
  let h = mk('CO', ['As', 'Ks']);
  h = { ...h, actions: [...skipTo(h, replay(h).final, 0), { p: 0, kind: 'raise', to: 500 }] };
  h = { ...h, actions: [...h.actions, ...onlyCaller(h, replay(h).final, h.button)], board: ['2c', '3d', '4h'] };
  const s = replay(h).final;
  assert.equal(checkAround(h, s).length, 2);
  const bet = { ...h, actions: [...h.actions, { p: 0, kind: 'bet' as const, to: 400 }] };
  assert.deepEqual(checkAround(bet, replay(bet).final), []);
});

test('next level: blinds go up one step and the ante keeps its share', () => {
  const g = { kind: 'mtt' as const, name: 'T', sb: 100, bb: 200, ante: 200, anteType: 'bb' as const, currency: '€', level: 1 };
  assert.deepEqual(nextLevel(g), { ...g, sb: 150, bb: 300, ante: 300, level: 2 });
  assert.equal(nextLevel({ ...g, kind: 'cash' }), null);
  assert.equal(nextLevel({ ...g, sb: 20000, bb: 40000 }), null);
});
