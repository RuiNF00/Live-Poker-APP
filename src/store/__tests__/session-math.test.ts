/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { breakdown, lastTimeAt, owedToBackers, parseDay, profit, totals } from '../session-math';
import type { Session } from '../types';

function mk(over: Partial<Session> = {}): Session {
  return {
    id: 's', kind: 'mtt', name: 'Main', venue: 'Estoril', currency: '€', startedAt: 0, endedAt: 4 * 3600000, breaks: [],
    buyIn: 100, entries: 1, addOn: 0, cashOut: 0, sb: 100, bb: 200, ante: 200, anteType: 'bb', tableSize: 9, stack: 30000,
    stackLog: [], roster: [], notes: '',
    ...over,
  };
}

test('no staking: profit is prize minus buy-ins minus expenses', () => {
  assert.equal(profit(mk({ cashOut: 500, entries: 2 })), 300);
  assert.equal(profit(mk({ cashOut: 500, expenses: 50 })), 350);
});

test('50% sold at 1.2 markup', () => {
  const s = mk({ buyIn: 1000, cashOut: 10000, staking: { sold: 50, markup: 1.2 } });
  // Backers paid 600, get 5000. You: 10000 - 5000 - (1000 - 600) = 4600.
  assert.equal(owedToBackers(s), 5000);
  assert.equal(profit(s), 4600);
  // Bust: you only lose your own 400.
  assert.equal(profit({ ...s, cashOut: 0 }), -400);
});

test('totals ROI uses your own money', () => {
  const s = mk({ buyIn: 1000, cashOut: 0, staking: { sold: 50, markup: 1 } });
  const t = totals([s]);
  assert.equal(t.invested, 500);
  assert.equal(t.roi, -100);
});

test('breakdown groups by venue, case-insensitive, skips blanks and live sessions', () => {
  const list = [
    mk({ id: 'a', venue: 'Estoril', cashOut: 300 }),
    mk({ id: 'b', venue: 'estoril', cashOut: 0 }),
    mk({ id: 'c', venue: 'Lisboa', cashOut: 0 }),
    mk({ id: 'd', venue: '', cashOut: 900 }),
    mk({ id: 'e', venue: 'Lisboa', endedAt: undefined }),
  ];
  const b = breakdown(list, 'venue');
  assert.deepEqual(b.map((x) => [x.key, x.sessions, x.profit]), [['Estoril', 2, 100], ['Lisboa', 1, -100]]);
  assert.equal(b[0].hours, 8);
});

test('parseDay reads dd/mm[/yyyy] and refuses the future', () => {
  const now = new Date(2026, 9, 17, 12).getTime();
  assert.equal(parseDay('3/10', now), new Date(2026, 9, 3).getTime());
  assert.equal(parseDay('03-10-25', now), new Date(2025, 9, 3).getTime());
  assert.equal(parseDay('20/12', now), new Date(2025, 11, 20).getTime());
  assert.equal(parseDay('31/02/2026', now), null);
  assert.equal(parseDay('1/1/2030', now), null);
  assert.equal(parseDay('ontem', now), null);
});

test('money shows cents with two digits in pt-PT', async () => {
  const { money } = await import('../../poker/format');
  assert.equal(money(370.5, '€'), '370,50€');
  assert.equal(money(-12.25, '€'), '−12,25€');
  assert.equal(money(370, '€'), '370€');
});

test('start time and duration as players type them', async () => {
  const { parseClock, parseDuration } = await import('../session-math');
  assert.equal(parseClock('20:30'), 20 * 60 + 30);
  assert.equal(parseClock('20h30'), 20 * 60 + 30);
  assert.equal(parseClock('2030'), 20 * 60 + 30);
  assert.equal(parseClock('9'), 9 * 60);
  assert.equal(parseClock('25:00'), null);
  assert.equal(parseClock('abc'), null);
  assert.equal(parseDuration('4h30'), 270);
  assert.equal(parseDuration('4:30'), 270);
  assert.equal(parseDuration('4,5'), 270);
  assert.equal(parseDuration('4'), 240);
  assert.equal(parseDuration('0'), null);
  assert.equal(parseDuration('60'), null);
});

test('lastTimeAt: a name played before brings its buy-in, blinds and starting stack', () => {
  const old = mk({ name: 'Deepstack', buyIn: 250, sb: 200, bb: 400, ante: 400, stack: 1, stackLog: [{ t: 0, stack: 40000 }] });
  const form = mk({ id: 'n', name: '', venue: '', buyIn: 100, endedAt: undefined });
  assert.deepEqual(lastTimeAt('Deepstack', form, [old]), { name: 'Deepstack', venue: 'Estoril', sb: 200, bb: 400, ante: 400, anteType: 'bb', buyIn: 250, stack: 40000 });
  // Another currency: blinds only; a venue already typed stays.
  const usd = lastTimeAt('Deepstack', { ...form, currency: '$', venue: 'Vegas' }, [old]);
  assert.equal(usd.buyIn, undefined);
  assert.equal(usd.venue, 'Vegas');
  // Cash: the stack is the buy-in; another kind or a new name only sets the name.
  const cash = mk({ kind: 'cash', name: 'NLH 1/2', buyIn: 300, sb: 1, bb: 2 });
  assert.equal(lastTimeAt('NLH 1/2', { ...form, kind: 'cash' }, [cash]).stack, 300);
  assert.deepEqual(lastTimeAt('NLH 1/2', form, [cash]), { name: 'NLH 1/2' });
});
