/// <reference types="node" />
// «A app lembra-se do teu jogo» (before/after list, item 5): outside a session, a new hand and a new
// live session open on the game the player last played, not on «Torneio 100/200».
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { lastEnded, nextLive } from '../../store/session-math';
import type { Session } from '../../store/types';
import { newHand } from '../factory';

const H = 3600_000;

function mk(over: Partial<Session> = {}): Session {
  return {
    id: 's', kind: 'cash', name: '', venue: 'Casino Lisboa', currency: '€', startedAt: Date.now() - 6 * H, endedAt: Date.now() - 2 * H, breaks: [],
    buyIn: 200, entries: 1, addOn: 0, cashOut: 260, sb: 1, bb: 2, ante: 0, anteType: 'none', tableSize: 8, stack: 260,
    stackLog: [], roster: [], notes: '',
    ...over,
  };
}

test('a cash player with sessions and no hands opens a new hand on their game, not «Torneio 100/200»', () => {
  const h = newHand({ id: 'n', recent: mk() });
  assert.equal(h.game.kind, 'cash');
  assert.deepEqual([h.game.sb, h.game.bb], [1, 2]);
  assert.equal(h.players.length, 8);
  assert.equal(h.players[0].stack, 200, 'a cash hand starts on the buy-in');
});

test('with nothing played yet, a new hand still opens on the default tournament', () => {
  const h = newHand({ id: 'n', recent: null });
  assert.equal(h.game.kind, 'mtt');
});

test('a tournament played last opens on its first stack, not where it ended', () => {
  const t = mk({ kind: 'mtt', sb: 2000, bb: 4000, ante: 4000, anteType: 'bb', stack: 0, stackLog: [{ t: 0, stack: 30000 }, { t: 1, stack: 12000 }] });
  const h = newHand({ id: 'n', recent: t });
  assert.equal(h.game.kind, 'mtt');
  assert.equal(h.players[0].stack, 30000);
});

test('a session that ended after the last hand wins; an older one does not', () => {
  const last = newHand({ id: 'l', recent: mk({ kind: 'mtt', sb: 100, bb: 200, stack: 30000 }) });
  const oldHand = { ...last, createdAt: Date.now() - 10 * H };
  assert.equal(newHand({ id: 'n', last: oldHand, recent: mk() }).game.kind, 'cash', 'cash played since the hand');
  const newer = { ...last, createdAt: Date.now() - H };
  assert.equal(newHand({ id: 'n', last: newer, recent: mk() }).game.kind, 'mtt', 'the hand is newer than the session');
});

test('the same table a few hours on keeps its seats even if a session ended in between', () => {
  const last = { ...newHand({ id: 'l', recent: mk({ kind: 'mtt', sb: 100, bb: 200, stack: 30000, tableSize: 9 }) }), createdAt: Date.now() - 3 * H };
  last.players = last.players.map((p, i) => (i === 3 ? { ...p, name: 'Zé' } : p));
  const h = newHand({ id: 'n', last, recent: mk() });
  assert.equal(h.players[3].name, 'Zé');
  assert.equal(h.game.kind, 'mtt');
});

test('lastEnded skips the running session and picks the latest end', () => {
  assert.equal(lastEnded([]), null);
  const a = mk({ id: 'a', endedAt: 100 });
  const b = mk({ id: 'b', endedAt: 300 });
  const live = mk({ id: 'c', endedAt: undefined, startedAt: 500 });
  assert.equal(lastEnded([a, live, b])?.id, 'b');
});

test('a new live session opens on the last cash game; a tournament keeps only the kind', () => {
  assert.deepEqual(nextLive('€', []), {});
  const cash = nextLive('€', [mk({ sb: 2, bb: 5, buyIn: 500 })]);
  assert.deepEqual(cash, { kind: 'cash', sb: 2, bb: 5, ante: 0, anteType: 'none', buyIn: 500, stack: 500 });
  assert.deepEqual(nextLive('€', [mk({ kind: 'mtt', sb: 2000, bb: 4000 })]), { kind: 'mtt' });
  assert.deepEqual(nextLive('$', [mk()]), {}, 'another currency is another game');
});
