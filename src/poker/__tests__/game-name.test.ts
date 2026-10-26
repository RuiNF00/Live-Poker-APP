import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameOfName, handCounts, sessionGame } from '../variant';
import { gameOf } from '../../store/tourney-stats';

test('one rule for the game in a name (Bankroll, PLO in the money screens)', () => {
  for (const n of ['PLO 1/2', 'PLO5 Bounty', 'PLO5', 'PLO6', 'NLO', 'FLO', 'Pot-Limit Omaha', 'Pot Limit Omaha', 'Omaha', 'omaha 2/5']) assert.equal(gameOfName(n), 'PLO', n);
  for (const n of ['PLO8', 'FLO8', 'NLO8', 'Omaha Hi/Lo', 'PLO Hi/Lo', 'Omaha hi-lo', 'Pot-Limit Omaha 8', 'O8', 'Big O']) assert.equal(gameOfName(n), 'PLO8', n);
  for (const n of ['Explorer Cup', 'Deploy Deepstack', 'Cash 1/2', 'Main Event', 'Slow Blinds']) assert.equal(gameOfName(n), 'NLH', n);
  for (const n of ['8-Game Mix', 'H.O.R.S.E.', 'PLO/NLH Mixed', "Dealer's Choice"]) assert.equal(gameOfName(n), 'Mix', n);
  assert.equal(gameOfName('Short Deck 6+'), 'Short Deck');
  // Tournaments group PLO8 with PLO.
  assert.equal(gameOf('FLO8 Championship'), 'PLO');
  assert.equal(gameOf('Explorer Cup'), 'NLH');
});

test("a session whose name says nothing takes the game most of its hands are", () => {
  const c = handCounts([
    { sessionId: 's', game: { kind: 'cash', name: '', variant: 'plo' } },
    { sessionId: 's', game: { kind: 'cash', name: '', variant: 'plo' } },
    { sessionId: 's', game: { kind: 'cash', name: '' } },
    { game: { kind: 'cash', name: '', variant: 'plo' } },
  ] as never);
  assert.deepEqual(c.get('s'), { plo: 2, all: 3 });
  assert.equal(sessionGame('Cash 1/2', 2, 3), 'PLO');
  assert.equal(sessionGame('Cash 1/2', 1, 2), 'NLH', 'a tie stays hold\'em');
  assert.equal(sessionGame('Cash 1/2'), 'NLH', 'no hands');
  assert.equal(sessionGame('8-Game', 3, 3), 'Mix', 'the name wins');
});
