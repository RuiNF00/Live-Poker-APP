/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { insights, MIN_SESSIONS } from '../insights-math';
import type { Session } from '../types';

const H = 3600000;
const DAY = 24 * H;
// A Monday, 20:00.
const MON = new Date(2026, 8, 7, 20).getTime();
const eur = (n: number) => `${Math.round(n)}€`;

let n = 0;
function cash(start: number, hours: number, result: number, over: Partial<Session> = {}): Session {
  return {
    id: 's' + n++, kind: 'cash', name: 'NLH 1/2', venue: 'Estoril', currency: '€', startedAt: start, endedAt: start + hours * H, breaks: [],
    buyIn: 200, entries: 1, addOn: 0, cashOut: 200 + result, sb: 1, bb: 2, ante: 0, anteType: 'none', tableSize: 9, stack: 0, stackLog: [], roster: [], notes: '', ...over,
  };
}

test('no cards without enough sessions on both sides', () => {
  const few = Array.from({ length: MIN_SESSIONS + 2 }, (_, i) => cash(MON + i * 7 * DAY, 4, 50));
  assert.deepEqual(insights(few, eur), []);
});

test('length: long sessions earn less per hour, with the sample', () => {
  const list = [
    ...Array.from({ length: 6 }, (_, i) => cash(MON + i * 7 * DAY, 4, 120)), // 30/h
    ...Array.from({ length: 6 }, (_, i) => cash(MON + i * 7 * DAY + DAY, 8, 144)), // 18/h
  ];
  const len = insights(list, eur).find((x) => x.id === 'length');
  assert.ok(len);
  assert.equal(len!.title, 'Depois das 6 horas o que ganhas por hora cai 40%.');
  assert.equal(len!.tone, 'bad');
  assert.deepEqual(len!.sample, { sessions: 12, hours: 72 });
  assert.deepEqual(len!.groups.map((g) => Math.round(g.rate)), [30, 18]);
});

test('weekday and venue name the losing side', () => {
  const list = [
    ...Array.from({ length: 6 }, (_, i) => cash(MON + i * 7 * DAY, 4, 160, { venue: 'Estoril' })),
    ...Array.from({ length: 6 }, (_, i) => cash(MON + i * 7 * DAY + 4 * DAY, 4, -80, { venue: 'Lisboa' })),
  ];
  const all = insights(list, eur);
  const wd = all.find((x) => x.id === 'weekday')!;
  assert.match(wd.title, /sexta/);
  assert.match(wd.title, /^Perdes dinheiro/);
  const venue = all.find((x) => x.id === 'venue')!;
  assert.equal(venue.title, 'Perdes dinheiro em Lisboa; Estoril é a sala onde rendes mais.');
  assert.equal(venue.unit, 'hour');
});

test('tilt: the session after a big loss is worse', () => {
  const list: Session[] = [];
  let at = MON;
  for (let i = 0; i < 6; i++) {
    list.push(cash(at, 4, -700)); // big loss (> 3 × the usual 200 buy-in)
    at += DAY;
    list.push(cash(at, 4, -100)); // the next day
    at += 3 * DAY;
    list.push(cash(at, 4, 300), cash(at + DAY, 4, 250));
    at += 3 * DAY;
  }
  const tilt = insights(list, eur).find((x) => x.id === 'tilt');
  assert.ok(tilt);
  assert.equal(tilt!.tone, 'bad');
  assert.equal(tilt!.groups[0].sessions, 6);
});

test('a custom result (swaps) changes the numbers', () => {
  const list = [
    ...Array.from({ length: 6 }, (_, i) => cash(MON + i * 7 * DAY, 4, 120)),
    ...Array.from({ length: 6 }, (_, i) => cash(MON + i * 7 * DAY + DAY, 8, 144)),
  ];
  const flat = insights(list, eur, { result: (s) => (s.endedAt! - s.startedAt) / H });
  assert.equal(flat.find((x) => x.id === 'length'), undefined, 'same rate on both sides: no card');
});

test('when every side loses, the best one "loses less" instead of "earns more"', () => {
  const list = [
    ...Array.from({ length: 6 }, (_, i) => cash(MON + i * 7 * DAY, 4, -40, { venue: 'Estoril' })),
    ...Array.from({ length: 6 }, (_, i) => cash(MON + i * 7 * DAY + DAY, 4, -160, { venue: 'Lisboa' })),
  ];
  const all = insights(list, eur);
  assert.equal(all.find((x) => x.id === 'venue')!.title, 'Perdes dinheiro em todas as salas; em Estoril perdes menos.');
  for (const x of all) assert.doesNotMatch(x.title, /rendes mais|melhor dia/);
  const len = [
    ...Array.from({ length: 6 }, (_, i) => cash(MON + i * 7 * DAY, 4, -160)),
    ...Array.from({ length: 6 }, (_, i) => cash(MON + i * 7 * DAY + DAY, 8, -80)),
  ];
  assert.equal(insights(len, eur).find((x) => x.id === 'length')!.title, 'Depois das 6 horas perdes menos por hora.');
});
