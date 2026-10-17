/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { replay } from '../engine';
import { easternTime, pokerStarsFile, pokerStarsText } from '../pokerstars';
import { sampleHand } from '../sample';
import type { Hand, HandAction } from '../types';

function mk(over: Partial<Hand> = {}): Hand {
  return {
    v: 1, id: 'h1', createdAt: Date.UTC(2026, 9, 17, 23, 4, 9), updatedAt: 0,
    game: { kind: 'cash', name: 'Casino Lisboa', sb: 1, bb: 2, ante: 0, anteType: 'none', currency: '€' },
    players: [
      { name: 'Rui', stack: 200, cards: ['As', 'Kd'] },
      { name: 'Zé', stack: 135 },
      { name: 'Ana', stack: 400, cards: ['Qs', 'Jh'] },
      { name: 'V3', stack: 200 },
      { name: 'V4', stack: 200 },
      { name: 'V5', stack: 200 },
    ],
    button: 0, hero: 0, actions: [], board: [], tags: [], notes: '',
    ...over,
  };
}

// A minimal PokerStars reader, the way trackers parse these files: seats,
// button, blinds, actions, board, cards. Used to prove the export round-trips.
function parse(txt: string): Pick<Hand, 'players' | 'button' | 'actions' | 'board'> & { sb: number; bb: number; ante: number } {
  const num = (s: string) => Number(s.replace(/[^\d.]/g, ''));
  const lines = txt.split('\n');
  const players: Hand['players'] = [];
  const names: string[] = [];
  let button = -1;
  let sb = 0;
  let bb = 0;
  let ante = 0;
  const actions: HandAction[] = [];
  let board: string[] = [];
  for (const l of lines) {
    if (l === '*** SUMMARY ***') break;
    let m: RegExpMatchArray | null;
    if ((m = l.match(/Seat #(\d+) is the button/))) button = Number(m[1]) - 1;
    else if ((m = l.match(/^Seat (\d+): (.+) \((\S+) in chips\)$/))) {
      players[Number(m[1]) - 1] = { name: m[2], stack: num(m[3]) };
      names[Number(m[1]) - 1] = m[2];
    } else if ((m = l.match(/^(.+): posts small blind (\S+)/))) sb = num(m[2]);
    else if ((m = l.match(/^(.+): posts big blind (\S+)/))) bb = num(m[2]);
    else if ((m = l.match(/^(.+): posts the ante (\S+)/))) ante = num(m[2]);
    else if ((m = l.match(/^Dealt to (.+) \[(.+)\]$/))) players[names.indexOf(m[1])].cards = m[2].split(' ');
    else if ((m = l.match(/^\*\*\* (FLOP|TURN|RIVER) \*\*\* (.+)$/))) board = m[2].replace(/[[\]]/g, '').split(' ');
    else if ((m = l.match(/^(.+): shows \[(.+)\]$/))) players[names.indexOf(m[1])].cards = m[2].split(' ');
    else if ((m = l.match(/^(.+): (folds|checks|calls|bets|raises)(?: (\S+))?(?: to (\S+))?/))) {
      const p = names.indexOf(m[1]);
      const kind = ({ folds: 'fold', checks: 'check', calls: 'call', bets: 'bet', raises: 'raise' } as Record<string, HandAction['kind']>)[m[2]];
      actions.push(kind === 'bet' ? { p, kind, to: num(m[3]) } : kind === 'raise' ? { p, kind, to: num(m[4]) } : { p, kind });
    }
  }
  return { players, button, actions, board, sb, bb, ante };
}

function roundTrip(h: Hand) {
  const txt = pokerStarsText(h);
  const back = parse(txt);
  assert.equal(back.button, h.button);
  assert.deepEqual(back.players.map((p) => p.stack), h.players.map((p) => p.stack));
  assert.deepEqual(back.board, h.board);
  if (!h.game.bombPot) {
    assert.equal(back.sb, h.game.sb);
    assert.equal(back.bb, h.game.bb);
  }
  const rebuilt: Hand = { ...h, players: back.players, actions: back.actions, board: back.board };
  const a = replay(h);
  const b = replay(rebuilt);
  // Same table, same story: every state and the payout match the original.
  assert.deepEqual(b.final.stacks, a.final.stacks);
  assert.deepEqual(b.result?.won, a.result?.won);
  assert.equal(b.steps.length, a.steps.length);
  return txt;
}

test('cash hand: header, seats, Stars wording, showdown and summary', () => {
  const h = mk({
    actions: [
      { p: 3, kind: 'fold' }, { p: 4, kind: 'fold' }, { p: 5, kind: 'fold' },
      { p: 0, kind: 'raise', to: 5 }, { p: 1, kind: 'fold' }, { p: 2, kind: 'call' },
      { p: 2, kind: 'check' }, { p: 0, kind: 'bet', to: 4 }, { p: 2, kind: 'call' },
      { p: 2, kind: 'check' }, { p: 0, kind: 'check' },
      { p: 2, kind: 'check' }, { p: 0, kind: 'bet', to: 15 }, { p: 2, kind: 'call' },
    ],
    board: ['Qd', '8h', '3h', '2c', 'Kc'],
  });
  const txt = roundTrip(h);
  const lines = txt.split('\n');
  assert.match(lines[0], /^PokerStars Hand #\d{12}: {2}Hold'em No Limit \(€1\/€2 EUR\) - 2026\/10\/17 23:04:09 UTC \[2026\/10\/17 19:04:09 ET\]$/);
  assert.equal(lines[1], "Table 'Casino Lisboa' 6-max Seat #1 is the button");
  assert.equal(lines[2], 'Seat 1: Hero (€200 in chips)');
  assert.equal(lines[3], 'Seat 2: SB (€135 in chips)');
  for (const l of [
    'SB: posts small blind €1',
    'BB: posts big blind €2',
    '*** HOLE CARDS ***',
    'Dealt to Hero [As Kd]',
    'Hero: raises €3 to €5',
    'BB: calls €3',
    '*** FLOP *** [Qd 8h 3h]',
    'Hero: bets €4',
    '*** TURN *** [Qd 8h 3h] [2c]',
    '*** RIVER *** [Qd 8h 3h 2c] [Kc]',
    '*** SHOW DOWN ***',
    'BB: shows [Qs Jh]',
    'Hero collected €49 from pot',
    'Total pot €49 | Rake €0',
    'Board [Qd 8h 3h 2c Kc]',
    'Seat 1: Hero (button) showed [As Kd] and won (€49)',
    'Seat 2: SB (small blind) folded before Flop',
    'Seat 3: BB (big blind) showed [Qs Jh] and lost',
    "Seat 4: UTG folded before Flop (didn't bet)",
  ])
    assert.ok(lines.includes(l), `missing: ${l}\n${txt}`);
  assert.ok(!/Rui|Zé|Ana/.test(txt));
});

test('fold win returns the uncalled bet', () => {
  const h = mk({ actions: [{ p: 3, kind: 'raise', to: 6 }, { p: 4, kind: 'fold' }, { p: 5, kind: 'fold' }, { p: 0, kind: 'fold' }, { p: 1, kind: 'fold' }, { p: 2, kind: 'fold' }] });
  const txt = roundTrip(h);
  assert.ok(txt.includes('Uncalled bet (€4) returned to UTG\nUTG collected €5 from pot'), txt);
  assert.ok(txt.includes('Seat 4: UTG collected (€5)'), txt);
  assert.ok(!txt.includes('SHOW DOWN'));
});

test('tournament with BB ante, all-in and run-out', () => {
  const h = mk({
    sessionId: 's1',
    game: { kind: 'mtt', name: 'Main Event', sb: 1000, bb: 2000, ante: 2000, anteType: 'bb', currency: '$', level: 12, buyIn: 550 },
    players: [
      { name: 'x', stack: 40000, cards: ['Ah', 'Ad'] },
      { name: '', stack: 100000, cards: ['Kc', 'Ks'] },
    ],
    actions: [{ p: 0, kind: 'raise', to: 40000 }, { p: 1, kind: 'call' }],
    board: ['2c', '7d', '9s', 'Th', '3c'],
  });
  const txt = roundTrip(h);
  assert.match(txt.split('\n')[0], /^PokerStars Hand #\d{12}: Tournament #\d{10}, \$550\+\$0 USD Hold'em No Limit - Level XII \(1000\/2000\) - /);
  assert.ok(txt.includes("2-max Seat #1 is the button"));
  assert.ok(txt.includes('BB: posts the ante 2000\nHero: posts small blind 1000\nBB: posts big blind 2000'), txt);
  assert.ok(txt.includes('Hero: raises 38000 to 40000 and is all-in\nBB: calls 38000'), txt);
  assert.ok(txt.includes('Hero collected 82000 from pot'), txt);
});

test('the sample hand and a file of several hands round-trip', () => {
  const a = sampleHand('a');
  roundTrip(a);
  const file = pokerStarsFile([{ ...a, id: 'b', createdAt: a.createdAt + 1000 }, a]);
  const parts = file.trimEnd().split('\n\n\n');
  assert.equal(parts.length, 2);
  assert.ok(parts.every((p) => p.startsWith('PokerStars Hand #')));
  assert.notEqual(parts[0].split(':')[0], parts[1].split(':')[0]);
});

test('Eastern time follows US daylight saving', () => {
  assert.equal(easternTime(Date.UTC(2026, 0, 15, 12, 0, 5)), '2026/01/15 7:00:05 ET');
  assert.equal(easternTime(Date.UTC(2026, 6, 15, 12, 0, 5)), '2026/07/15 8:00:05 ET');
});

const live = (game: Partial<Hand['game']>, over: Partial<Hand> = {}) => mk({ game: { ...mk().game, name: 'Bellagio', currency: '$', ...game }, ...over });

test('UTG straddle and re-straddle post after the blinds and the action starts after them', () => {
  const h = live({ straddles: 2, straddleFrom: 'utg' }, {
    actions: [{ p: 5, kind: 'raise', to: 20 }, { p: 0, kind: 'fold' }, { p: 1, kind: 'fold' }, { p: 2, kind: 'fold' }, { p: 3, kind: 'fold' }, { p: 4, kind: 'call' }, { p: 4, kind: 'check' }, { p: 5, kind: 'bet', to: 25 }, { p: 4, kind: 'fold' }],
    board: ['Qd', '8h', '3h'],
  });
  const txt = roundTrip(h);
  assert.ok(txt.includes('SB: posts small blind $1\nBB: posts big blind $2\nUTG: posts straddle $4\nHJ: posts straddle $8\n*** HOLE CARDS ***'), txt);
  assert.ok(txt.includes('CO: raises $12 to $20'), txt);
});

test('button straddle', () => {
  const h = live({ straddles: 1, straddleFrom: 'btn' }, { actions: [{ p: 1, kind: 'fold' }, { p: 2, kind: 'fold' }, { p: 3, kind: 'fold' }, { p: 4, kind: 'fold' }, { p: 5, kind: 'fold' }] });
  const txt = roundTrip(h);
  // The button straddler acts last; the action opens on the small blind.
  assert.ok(txt.includes('BB: posts big blind $2\nHero: posts straddle $4\n*** HOLE CARDS ***\nDealt to Hero [As Kd]\nSB: folds'), txt);
  assert.ok(txt.includes('Hero collected'), txt);
});

test('button ante is posted by the button', () => {
  const h = live({ ante: 2, anteType: 'btn' }, { actions: [{ p: 3, kind: 'raise', to: 6 }, { p: 4, kind: 'fold' }, { p: 5, kind: 'fold' }, { p: 0, kind: 'fold' }, { p: 1, kind: 'fold' }, { p: 2, kind: 'fold' }] });
  const txt = roundTrip(h);
  assert.ok(txt.includes('Hero: posts the ante $2\nSB: posts small blind $1'), txt);
  assert.equal(txt.match(/posts the ante/g)?.length, 1);
});

test('bomb pot: everyone antes, no blinds, the hand opens on the flop and the table says so', () => {
  const h = live({ bombPot: 10 }, {
    actions: [{ p: 1, kind: 'bet', to: 20 }, { p: 2, kind: 'fold' }, { p: 3, kind: 'fold' }, { p: 4, kind: 'fold' }, { p: 5, kind: 'fold' }, { p: 0, kind: 'call' }, { p: 1, kind: 'check' }, { p: 0, kind: 'check' }, { p: 1, kind: 'check' }, { p: 0, kind: 'check' }],
    board: ['Qd', '8h', '3h', '2c', 'Kc'],
  });
  const txt = roundTrip(h);
  assert.ok(txt.includes("Table 'Bellagio - Bomb pot $10' 6-max"), txt);
  assert.equal(txt.match(/posts the ante \$10/g)?.length, 6);
  assert.ok(!/blind/.test(txt.split('*** SUMMARY ***')[0]), txt);
  assert.ok(txt.includes('*** HOLE CARDS ***\nDealt to Hero [As Kd]\n*** FLOP *** [Qd 8h 3h]\nSB: bets $20'), txt);
});
