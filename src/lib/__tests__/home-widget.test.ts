/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Session } from '../../store/types';
import { money } from '../../poker/format';
import { widgetProps, type WidgetInput } from '../home-widget/widget-state';

const H = 3_600_000;
// Wednesday 14 Oct 2026, 12:00 local: the week starts Monday the 12th.
const NOW = new Date(2026, 9, 14, 12).getTime();
const MON = new Date(2026, 9, 12, 0).getTime();

function mk(over: Partial<Session> = {}): Session {
  return {
    id: 's', kind: 'cash', name: 'NL 2/5', venue: 'Estoril', currency: '$', startedAt: MON + 20 * H, endedAt: MON + 24 * H, breaks: [],
    buyIn: 500, entries: 1, addOn: 0, cashOut: 0, sb: 2, bb: 5, ante: 0, anteType: 'bb', level: 1, tableSize: 9, stack: 500,
    stackLog: [], roster: [], notes: '',
    ...over,
  };
}

const base: WidgetInput = { activeSession: null, sessions: [], hands: [], players: [], currency: '$', hideAmounts: false, streakPauses: [] };

test('no session: this week in the main currency, older weeks and other currencies left out', () => {
  const sessions = [
    mk({ id: 'a', cashOut: 1740 }), // +1240, 4h
    mk({ id: 'b', startedAt: MON + 44 * H, endedAt: MON + 46 * H, cashOut: 0 }), // −500, 2h
    mk({ id: 'old', startedAt: MON - 30 * H, endedAt: MON - 26 * H, cashOut: 9000 }),
    mk({ id: 'eur', currency: '€', cashOut: 9000 }),
  ];
  const p = widgetProps({ ...base, sessions }, NOW);
  assert.equal(p.live, false);
  assert.equal(p.result, '+' + money(740, '$'));
  assert.equal(p.tone, 'up');
  assert.match(p.weekSub, /^2 sess/);
  assert.match(p.weekSub, /6h/);
});

test('amounts hidden: no money on the home screen', () => {
  const p = widgetProps({ ...base, hideAmounts: true, sessions: [mk({ cashOut: 1740 })] }, NOW);
  assert.equal(p.result, '•••');
  assert.equal(p.tone, 'flat');
});

test('nothing played this week: a dash, and the streak counts logging', () => {
  const p = widgetProps({ ...base, hands: [{ createdAt: NOW - 1000 }, { createdAt: NOW - 7 * 24 * H }] }, NOW);
  assert.equal(p.result, '—');
  assert.equal(p.tone, 'flat');
  assert.equal(p.streakOn, true);
  assert.match(p.streak, /^2 /);
});

test('running session: live props for the clock, stack and blinds', () => {
  const s = mk({ id: 'live', kind: 'mtt', startedAt: NOW - 2 * H, endedAt: undefined, stack: 42000, sb: 400, bb: 800 });
  const p = widgetProps({ ...base, activeSession: s }, NOW);
  assert.equal(p.live, true);
  assert.equal(p.clockFrom, NOW - 2 * H);
  assert.equal(p.paused, false);
  assert.match(p.stackBB, /52/);
  assert.match(p.blinds, /400/);
});
