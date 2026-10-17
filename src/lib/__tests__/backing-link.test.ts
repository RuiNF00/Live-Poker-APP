/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Session, StakePackage } from '../../store/types';
import { buildStatement, checkStatement, decodeStatement, encodeStatement, MAX_ROWS, statementUrl } from '../backing-link';

let n = 0;
function mk(over: Partial<Session> = {}): Session {
  n++;
  return {
    id: 's' + n, kind: 'mtt', name: 'Main', venue: 'Estoril', currency: '€', startedAt: n * 1000, endedAt: n * 1000 + 500, breaks: [],
    buyIn: 1000, entries: 1, addOn: 0, cashOut: 0, sb: 100, bb: 200, ante: 200, anteType: 'bb', tableSize: 9, stack: 30000,
    stackLog: [], roster: [], notes: 'segredo: o João tilta', ...over,
  };
}

const backer = { id: 'b1', name: 'Miguel São João 🦈', note: 'IBAN PT50…', shareKey: 'k_abc123', createdAt: 0 };

test('statement carries only this backer\'s pieces, never notes or other backers', () => {
  const pkg: StakePackage = { id: 'p1', backerId: 'b1', name: 'Série de outubro', kind: 'action', share: 20, markup: 1.1, playerCut: 0, createdAt: 0 };
  const a = mk({ cashOut: 5000, stakes: [{ backerId: 'b1', packageId: 'p1', share: 20, markup: 1.1 }, { backerId: 'b2', share: 30, markup: 1 }] });
  const running = mk({ endedAt: undefined, live: { id: 'Live12345', token: 'secret-token' }, stakes: [{ backerId: 'b1', share: 10, markup: 1, unpaid: true }] });
  const other = mk({ stakes: [{ backerId: 'b2', share: 50, markup: 1 }] });
  const st = buildStatement(backer, 'Rui', '€', [a, running, other], [pkg], [], 42);
  assert.equal(st.rows.length, 2);
  const json = JSON.stringify(st);
  for (const leak of ['segredo', 'IBAN', 'b2', 'secret-token', 'Estoril']) assert.ok(!json.includes(leak), leak);
  const done = st.rows.find((r) => r.e)!;
  assert.equal(done.c, 220);
  assert.equal(done.o, 1000);
  assert.equal(done.p, 'Série de outubro');
  const live = st.rows.find((r) => !r.e)!;
  assert.equal(live.l, 'Live12345');
  assert.equal(live.u, 1);
  assert.equal(st.bal, 1000 - 100);
});

test('round trip through the link keeps accents and emoji', () => {
  const st = buildStatement(backer, 'Rui Ñ', '€', [mk({ cashOut: 2000, name: 'Torneio de Sábado', stakes: [{ backerId: 'b1', share: 50, markup: 1 }] })], [], [], 7);
  const url = statementUrl(st, 'ABC123');
  assert.ok(url.includes('/b?r=ABC123#'));
  assert.deepEqual(decodeStatement(url), st);
  assert.deepEqual(decodeStatement(encodeStatement(st)), st);
  // Pasting the whole message the player sent works.
  assert.deepEqual(decodeStatement(`Staking com Miguel\nDevo-te 1000€.\n\nAs contas: ${url}\nAbraço`), st);
});

test('a tampered or foreign link is rejected or cleaned up', () => {
  assert.equal(decodeStatement('https://sweatbook.poker/b#nope'), null);
  assert.equal(decodeStatement(''), null);
  assert.equal(checkStatement({ v: 1, id: 'bad id!', rows: [] }), null);
  const st = checkStatement({ v: 1, id: 'k_abc123', pl: 'x'.repeat(500), cur: '€', rows: [{ d: 1, sh: 900, mu: 99, l: '../../evil', c: 'x' }, 'junk'] })!;
  assert.equal(st.pl.length, 40);
  assert.equal(st.rows.length, 1);
  assert.equal(st.rows[0].sh, 0);
  assert.equal(st.rows[0].mu, 1);
  assert.equal(st.rows[0].l, undefined);
  assert.equal(st.rows[0].c, 0);
});

test('long histories are cut to the newest sessions', () => {
  const many = Array.from({ length: MAX_ROWS + 10 }, () => mk({ stakes: [{ backerId: 'b1', share: 10, markup: 1 }] }));
  const st = buildStatement(backer, 'Rui', '€', many, [], []);
  assert.equal(st.rows.length, MAX_ROWS);
  assert.equal(st.rows[0].d, many[many.length - 1].startedAt);
  assert.ok(statementUrl(st).length < 8000);
});

test('statement says what the app says: its ledger (rates, festival pieces to come) and each row in its own currency', async () => {
  const { backerLedger, packageStates } = await import('../../store/staking');
  const eur = mk({ cashOut: 3000, stakes: [{ backerId: 'b1', share: 10, markup: 1 }] });
  const usd = mk({ currency: '$', buyIn: 2000, cashOut: 0, stakes: [{ backerId: 'b1', share: 50, markup: 1 }] });
  const table = { '1970-01-01': { USD: 1.1 } };
  const l = backerLedger('b1', [eur, usd], [], [], packageStates([eur, usd], []), { table, fallback: '€' });
  // What useStaking adds for festival events not started yet.
  l.unpaid += 150;
  l.balance -= 150;
  const st = buildStatement(backer, 'Rui', l.currency, [eur, usd], [], [], 9, undefined, l);
  assert.equal(st.cur, '$');
  assert.equal(st.bal, Math.round(l.balance * 100) / 100);
  assert.equal(st.inv, Math.round(l.invested * 100) / 100);
  const eurRow = st.rows.find((r) => r.cu === '€');
  assert.ok(eurRow, 'the € session says it is in €');
  assert.equal(st.rows.find((r) => r.c === 1000)?.cu, undefined);
  assert.equal(decodeStatement(encodeStatement(st))?.rows.find((r) => r.cu)?.cu, '€');
});
