/// <reference types="node" />
// Tap budget for the hand-entry screen. A small driver plays the same moves the
// screen offers (position + cards, presets, "só X paga", a tap on a seat the
// app folded by itself ("alguém entrou?"),
// "todos check", board cards, save) and counts one tap per press, so a change
// that makes the common hands slower fails here.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buttonForHeroPosition, legal, positions, replay } from '../engine';
import { autoFold, callerCandidates, checkAround, checkDownNext, limpedPot, limpIn, onlyCaller, rewindTo, sizePresets, sizeToRemember, skipTo, type SizeMemory } from '../entry';
import { newHand, nextLevel, sameTable } from '../factory';
import type { Hand, HandAction } from '../types';

function mk(heroPos: string, heroCards: string[], n = 9, kind: 'mtt' | 'cash' = 'mtt'): Hand {
  const players = Array.from({ length: n }, (_, i) => ({ name: i ? '' : 'Hero', stack: 20000, cards: i ? undefined : heroCards }));
  return {
    v: 1, id: 't', createdAt: 0, updatedAt: 0,
    game: kind === 'mtt' ? { kind, name: 'T', sb: 100, bb: 200, ante: 200, anteType: 'bb', currency: '€' } : { kind, name: 'C', sb: 100, bb: 200, ante: 0, anteType: 'bb', currency: '€' },
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
  /** What hand/new.tsx keeps in settings: the last size per spot. */
  memory: SizeMemory = {};

  constructor(heroPos: string, heroCards: string[], kind: 'mtt' | 'cash' = 'mtt') {
    this.hand = mk(heroPos, heroCards, 9, kind);
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
  private bet(to: number) {
    const s = this.s;
    const m = sizeToRemember(this.hand, s, to);
    if (m) this.memory = { ...this.memory, [m.spot]: m.mult };
    this.push([{ p: s.toAct!, kind: legal(s)!.canBet ? 'bet' : 'raise', to }]);
  }
  size(label: string) {
    // Labels follow the locale (2,5x in Portuguese); the tests name them with a dot.
    const p = sizePresets(this.hand, this.s, this.memory).find((x) => x.label.replace(',', '.') === label);
    assert.ok(p, `no preset ${label}`);
    this.bet(p.to);
  }
  /** The keypad: open it, switch to bb, type the digits (e.g. "2,2" is 3), confirm. */
  keypad(bbs: number) {
    const keys = String(bbs).replace('.', ',').length;
    this.taps += 1 + 1 + keys + 1 - 1; // push() adds the confirm tap
    this.bet(Math.round(bbs * this.hand.game.bb));
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
  /** After a limp, the "Mais limps?" chip: that seat limps in one tap. */
  limp(label: string) {
    assert.ok(limpedPot(this.hand, this.autoFrom), '"mais limps?" not shown');
    const actions = limpIn(this.hand, this.autoFrom!, this.seat(label));
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
  /** "Check até ao fim": this street now, every later street once its card is in. */
  checkDown() {
    this.push(checkAround(this.hand, this.s));
    this.down = true;
  }
  private down = false;
  board(...cards: string[]) {
    assert.ok(this.s.needsBoard);
    this.taps += cards.length;
    this.hand = { ...this.hand, board: [...this.hand.board, ...cards] };
    if (this.down) this.hand = { ...this.hand, actions: [...this.hand.actions, ...checkDownNext(this.hand)] };
    this.settle();
  }
  /** Showdown with no cards shown: one tap on the winner. */
  winner(label: string) {
    this.taps++;
    const i = label === 'Hero' ? this.hand.hero : this.seat(label);
    this.hand = { ...this.hand, winners: [i] };
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
    e.size('2.5x');
    e.only(caller);
    e.board('Kc', '8d', '3s');
    if (caller === 'BB') e.act('check');
    e.size('⅓');
    e.act('fold');
    const r = e.save();
    assert.equal(e.taps, taps, caller);
    assert.equal(r.final.foldWin, true);
  }
});

test('guardar rápido: position and cards, then «Guardar já» is 4 taps (5 with a voice note)', () => {
  const e = new Entry('HJ', ['9s', '9h']);
  const r = e.saveWithVoice('file:///voice/t.m4a');
  assert.equal(e.taps, 5);
  assert.equal(e.hand.voiceNote, 'file:///voice/t.m4a');
  assert.equal(r.final.toAct, 0, 'reopens at hero, ready to complete');
});

test('single-raised pot: hero opens CO, BTN calls, c-bet called, gives up on the turn — 15 taps', () => {
  const e = new Entry('CO', ['As', 'Qd']);
  assert.equal(e.s.toAct, 0, 'folds to hero by themselves');
  e.size('2.5x');
  e.only('BTN');
  e.board('Kh', '7c', '2d');
  e.size('⅓');
  e.only('BTN');
  e.board('9s');
  e.act('check');
  e.size('½');
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
  e.size('⅓');
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
  e.size('½');
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
  e.size('⅓');
  e.act('call');
  e.board('2h');
  e.checkAround();
  e.board('3s');
  e.size('½');
  e.act('fold');
  const r = e.save();
  assert.equal(e.taps, 18);
  assert.equal(r.final.foldWin, true);
});

test('after undo, a different line of the same length still folds to hero', () => {
  const e = new Entry('BTN', ['Ah', 'Qh']);
  e.entered('UTG+1');
  e.size('2.5x');
  assert.equal(e.s.toAct, 0);
  e.undo(); // auto-folds after the open
  e.undo(); // the open
  e.undo(); // the rewind: back to the first auto-fold
  e.entered('UTG');
  e.size('2.5x');
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

test('the next hand at the same table keeps the villains in their seats', () => {
  const last = { ...mk('CO', ['As', 'Kd']), createdAt: Date.now() - 60_000 };
  last.players = last.players.map((p, i) => (i === 3 ? { ...p, name: 'Zé' } : p));
  assert.equal(newHand({ id: 'n', last }).players[3].name, 'Zé');
  assert.equal(newHand({ id: 'n', last: { ...last, createdAt: Date.now() - 8 * 3600_000 } }).players[3].name, '', 'a different day starts empty');
});

test('the next hand at the same table skips the position tap: the typical hand takes 10', () => {
  const e = new Entry('CO', ['Ah', 'Kd']);
  e.size('2.5x');
  e.only('BTN');
  e.board('Kc', '8d', '3s');
  e.size('⅓');
  e.act('fold');
  e.save();
  const last = { ...e.hand, createdAt: Date.now() };
  assert.ok(sameTable(last), 'hand/new.tsx opens with the position already chosen');
  const next = newHand({ id: 'n', last });
  assert.equal(positions(next.players.length, next.button)[next.hero], 'HJ', 'the button moved, hero is one seat earlier');
  assert.equal(e.taps - 1, 10);
});

// ── Tap audit (2026-10-17): five typical live hands at the table ─────────────
// Before = the integration head before this change; after = now.

test('audit 1a: raise and everyone folds — 6 taps', () => {
  const e = new Entry('CO', ['Ah', 'Jd']);
  e.size('2.5x');
  e.only(null);
  const r = e.save();
  assert.equal(e.taps, 6);
  assert.equal(r.final.foldWin, true);
});

test('audit 1b: hero opens, BTN 3-bets, the blinds fold by themselves, hero folds — 7 taps (was 8)', () => {
  const e = new Entry('CO', ['Kh', 'Td']);
  e.size('2.5x');
  e.size('3x'); // BTN 3-bets
  assert.equal(e.s.toAct, 0, 'SB and BB fold by themselves after the 3-bet');
  e.act('fold');
  const r = e.save();
  assert.equal(e.taps, 7);
  assert.equal(r.final.foldWin, true);
});

test('audit 1b: a blind who called the 3-bet is one tap on its seat', () => {
  const e = new Entry('CO', ['Kh', 'Td']);
  e.size('2.5x');
  e.size('3x');
  e.entered('BB');
  e.act('call');
  assert.equal(e.s.toAct, 0);
});

test('audit 3: single-raised pot to showdown — 17 taps', () => {
  const e = new Entry('CO', ['Ac', 'Qc']);
  e.size('2.5x');
  e.only('BTN');
  e.board('Qh', '8d', '4s');
  e.size('⅓');
  e.only('BTN');
  e.board('2c');
  e.checkAround();
  e.board('7h');
  e.checkAround();
  e.shows('BTN', ['Kd', 'Qs']);
  const r = e.save();
  assert.equal(e.taps, 17);
  assert.equal(r.result!.resolved, true);
  assert.deepEqual(r.result!.pots[0].winners, [0]);
});

test('audit 4: limped multiway (UTG and CO limp, SB completes, hero checks the BB) — 19 taps', () => {
  const e = new Entry('BB', ['9c', '5c']);
  e.entered('UTG');
  e.act('call');
  e.entered('CO');
  e.act('call');
  e.entered('SB'); // BTN and SB folded by themselves; the SB completing is a tap on its seat
  e.act('call');
  e.act('check');
  e.board('Td', '6h', '2c');
  e.checkAround();
  e.board('5d');
  e.skip('Hero');
  e.size('½');
  e.only(null);
  const r = e.save();
  assert.equal(e.taps, 19);
  assert.equal(r.final.foldWin, true);
});

test('remembered size: a player who opens 2.2x pays the keypad once, then it is a chip', () => {
  const first = new Entry('CO', ['Ah', 'Kd']);
  first.keypad(2.2);
  first.only(null);
  first.save();
  assert.equal(first.taps, 3 + 6 + 1 + 1, 'keypad, bb, "2", ",", "2", confirm');

  const next = new Entry('CO', ['Ah', 'Kd']);
  next.memory = first.memory;
  const presets = sizePresets(next.hand, next.s, next.memory);
  assert.deepEqual(presets.map((p) => p.label.replace(',', '.')), ['2.2x', '2.5x', '3x', 'All-in'], '2.2x takes the place of 2x');
  assert.equal(presets.find((p) => p.last)?.to, 440);
  next.size('2.2x');
  next.only(null);
  next.save();
  assert.equal(next.taps, 6, 'was 11 every hand');
});

test('remembered size: the typical hand with a 2.2x open and a 25% c-bet — 11 taps (was 19)', () => {
  const play = (e: Entry, before: boolean) => {
    if (before) e.keypad(2.2);
    else e.size('2.2x');
    e.only('BTN');
    e.board('Kc', '8d', '3s');
    if (before) e.keypad(1); // ¼ pot of 4 bb+ in bb, typed
    else e.size('¼');
    e.act('fold');
    e.save();
  };
  const before = new Entry('CO', ['Ah', 'Kd']);
  play(before, true);
  const after = new Entry('CO', ['Ah', 'Kd']);
  after.memory = { open: 2.2, bet: 0.25 };
  play(after, false);
  assert.equal(after.taps, 11);
  assert.equal(before.taps, 19);
});

test('size memory: spots are kept apart, all-in is never remembered, cash opens bigger', () => {
  const h0 = mk('CO', ['Ah', 'Kd']);
  const h = { ...h0, actions: autoFold(h0, replay(h0).final) };
  const s = replay(h).final;
  assert.deepEqual(sizeToRemember(h, s, 440), { spot: 'open', mult: 2.2 });
  assert.deepEqual(sizePresets(h, s).map((p) => p.label), ['2x', '2,5x', '3x', 'All-in'], 'decimal comma, as the bb line below it');
  assert.equal(sizeToRemember(h, s, 20000), null);
  assert.equal(sizeToRemember(h0, replay(h0).final, 440), null, "UTG's open is not hero's size");
  const c = mk('CO', ['Ah', 'Kd'], 9, 'cash');
  assert.deepEqual(sizePresets(c, replay(c).final).map((p) => p.label), ['3x', '4x', '5x', 'All-in']);
  // Postflop: a remembered ¾ replaces ⅔, the open memory does not leak in.
  let p = mk('CO', ['Ah', 'Kd']);
  p = { ...p, actions: [...skipTo(p, replay(p).final, 0), { p: 0, kind: 'raise', to: 500 }] };
  p = { ...p, actions: [...p.actions, ...onlyCaller(p, replay(p).final, p.button)], board: ['2c', '3d', '4h'] };
  const ps = sizePresets(p, replay(p).final, { open: 2.2, bet: 0.75 });
  assert.deepEqual(ps.map((x) => x.label), ['⅓', '½', '¾', 'Pote', 'All-in']);
  assert.equal(ps.filter((x) => x.last).length, 1);
});

test('the store copy hand: open, call, checked down to the river, winner picked, saved — 15 taps', () => {
  // Marketing and the store say this number; change them together with it.
  const e = new Entry('CO', ['Ah', 'Kd']);
  e.size('2.5x');
  e.only('BTN');
  e.board('Kc', '8d', '3s');
  e.checkAround();
  e.board('7h');
  e.checkAround();
  e.board('2c');
  e.checkAround();
  assert.equal(e.s.toAct, null, 'showdown');
  e.taps++; // "Quem ganhou?": one chip (or two taps for the villain's cards)
  e.save();
  assert.equal(e.taps, 15);
});

// Round 3 (Rui: "o menos trabalho possível"): three typical live hands, from position to saved.
test('round 3 · open, call, c-bet, fold — 11 taps (10 at the same table)', () => {
  const e = new Entry('CO', ['Ah', 'Kd']);
  e.size('2.5x');
  e.only('BTN');
  e.board('Kc', '8d', '3s');
  e.size('⅓');
  e.act('fold');
  e.save();
  assert.equal(e.taps, 11);
});

test('round 3 · 3-bet pot to showdown, checked down from the turn — 19 taps (was 20)', () => {
  const run = (down: boolean) => {
    const e = new Entry('BTN', ['Qs', 'Qc']);
    e.entered('CO');
    e.size('2.5x');
    e.size('3x');
    e.only('CO');
    e.board('Jh', '8c', '3d');
    e.act('check');
    e.size('⅓');
    e.act('call');
    e.board('2s');
    if (down) e.checkDown();
    else e.checkAround();
    e.board('7d');
    if (!down) e.checkAround();
    e.shows('CO', ['Ad', 'Jd']);
    const r = e.save();
    assert.equal(r.result!.resolved, true);
    return e.taps;
  };
  assert.equal(run(false), 20);
  assert.equal(run(true), 19);
});

test('round 3 · limped pot checked down to the river — 16 taps (was 20)', () => {
  const run = (now: boolean) => {
    const e = new Entry('BB', ['9c', '5c']);
    e.entered('UTG');
    e.act('call');
    if (now) {
      e.limp('BTN');
      e.limp('SB');
    } else {
      e.entered('BTN');
      e.act('call');
      e.entered('SB');
      e.act('call');
    }
    assert.equal(e.s.toAct, e.hand.hero);
    e.act('check');
    e.board('Td', '6h', '2c');
    if (now) e.checkDown();
    else e.checkAround();
    e.board('Ks');
    if (!now) e.checkAround();
    e.board('3h');
    if (!now) e.checkAround();
    assert.equal(e.s.toAct, null, 'river checked through');
    e.winner('Hero');
    e.save();
    return e.taps;
  };
  assert.equal(run(false), 20);
  assert.equal(run(true), 16);
});

test('mais limps: only after a limp and before any raise', () => {
  const e = new Entry('BB', ['9c', '5c']);
  assert.equal(limpedPot(e.hand, e.autoFrom), false, 'nobody limped yet: a chip gives the seat its turn');
  e.entered('UTG');
  e.size('2.5x');
  assert.equal(limpedPot(e.hand, e.autoFrom), false, 'after an open the chip gives the seat its turn');
});
