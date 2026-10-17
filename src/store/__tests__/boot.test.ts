/// <reference types="node" />
// Launch tests: the app must open on whatever an earlier version left on the
// phone, or on values a full disk or a killed update cut short, without
// crashing and without losing anything. What can't be used is moved to
// quarantine (raw value kept), never handed to a screen and never deleted.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { keysToErase } from '@/lib/erase-core';
import { isComplete, positions, replay } from '@/poker/engine';
import { blindsLabel } from '@/poker/format';
import type { Hand } from '@/poker/types';

import { balanceOf, ensureBankrolls } from '../bankroll-math';
import { KEYS, QUARANTINE, SPECS, loadAll, type Boot } from '../boot';
import { createWriter, type CollectionSpec } from '../persist';
import { curve, profit, totals } from '../session-math';
import { withCuts } from '../staking';
import { FakeStorage } from './fake-storage';
import { RELEASES, current, release1, type Release } from './launch-fixtures';

const LISTS = Object.keys(SPECS) as (keyof typeof SPECS)[];

/** What StoreProvider does on launch: read, write back whatever isn't in the current layout, save settings. */
async function launch(kv: FakeStorage): Promise<Boot> {
  const d = await loadAll(kv);
  for (const name of LISTS) {
    const l = d[name];
    const items = name === 'bankrolls' ? ensureBankrolls(d.bankrolls.items, d.sessions.items, d.settings.currency) : l.items;
    const w = createWriter(kv, SPECS[name] as CollectionSpec, l.persisted as { id: string }[], (e) => assert.fail(String(e)), 0);
    if (l.persisted !== items) w.schedule(items as { id: string }[]);
    await w.flush();
  }
  await kv.setItem(KEYS.settings, JSON.stringify(d.settings));
  return d;
}

/** What the screens compute from the data on the first frames: none of it may throw. */
function exercise(d: Boot) {
  const show = (h: Hand) => {
    const r = replay(h);
    isComplete(h, r);
    positions(h.players.length, h.button);
    blindsLabel(h);
    void h.players[h.hero].cards?.length;
    void h.tags.length;
  };
  d.hands.items.forEach(show);
  if (d.draft) show(d.draft);
  const sessions = withCuts(d.sessions.items, d.packages.items);
  sessions.forEach(profit);
  totals(sessions);
  curve(sessions);
  const br = ensureBankrolls(d.bankrolls.items, sessions, d.settings.currency);
  assert.ok(br.length > 0);
  balanceOf({ currency: d.settings.currency }, sessions, d.transfers.items, br);
  for (const s of sessions) void (s.breaks.length + s.stackLog.length + s.roster.length);
  for (const p of d.players.items) void p.tags.length;
  for (const t of d.trips.items) void t.expenses.length;
}

const quarantineOf = (kv: FakeStorage) => [...kv.data.entries()].filter(([k]) => k.startsWith(QUARANTINE));
const ids = (l: { id: string }[]) => l.map((x) => x.id).sort();

for (const make of RELEASES) {
  test(`arranque com dados de "${make().name}": nada se perde, nada vai para quarentena`, async () => {
    const r: Release = make();
    const d = await launch(r.kv);
    assert.equal(d.quarantined, 0);
    assert.equal(d.unreadable, 0);
    assert.equal(d.hands.items.length, r.hands);
    assert.equal(d.sessions.items.length, r.sessions);
    assert.equal(d.players.items.length, r.players);
    exercise(d);

    // Second launch reads the current layout only, and finds the same data.
    for (const k of r.kv.data.keys()) assert.ok(!Object.values(SPECS).some((s) => 'legacy' in s && s.legacy === k), `v1 key left: ${k}`);
    const again = await loadAll(r.kv);
    assert.equal(again.quarantined, 0);
    // (plus the bankroll the first launch makes for data from before bankrolls)
    for (const name of LISTS) assert.deepEqual(ids(again[name].items), ids(name === 'bankrolls' ? ensureBankrolls(d.bankrolls.items, d.sessions.items, d.settings.currency) : d[name].items), name);
    assert.deepEqual(again.hands.items, d.hands.items);
    assert.deepEqual(again.settings, d.settings);
  });
}

test('definições antigas guardam o que tinham e ganham os campos novos', async () => {
  const d = await launch(release1().kv);
  assert.equal(d.settings.inBB, true);
  assert.equal(d.settings.nickname, 'Rui');
  assert.equal(d.settings.defaultTableSize, 6);
  assert.equal(d.settings.shareNotes, true);
  assert.equal(d.draft?.id, 'h99');
});

// Each case damages one value on a phone with current data; `quarantined` is
// how many values must end up set aside (0 when the value is repaired).
type Case = { name: string; key: string; raw: string | ((old: string) => string); quarantined: number; check?: (d: Boot) => void };
const H = SPECS.hands.prefix;
const S = SPECS.sessions.prefix;
const cut = (s: string) => s.slice(0, Math.floor(s.length / 2));
const edit = (f: (x: Record<string, unknown>) => void) => (old: string) => {
  const x = JSON.parse(old);
  f(x);
  return JSON.stringify(x);
};

const CASES: Case[] = [
  { name: 'mão com JSON cortado a meio', key: H + 'h3', raw: cut, quarantined: 1 },
  { name: 'mão vazia', key: H + 'h3', raw: '', quarantined: 1 },
  { name: 'mão null', key: H + 'h3', raw: 'null', quarantined: 1 },
  { name: 'mão que é um número', key: H + 'h3', raw: '42', quarantined: 1 },
  { name: 'mão que é uma lista', key: H + 'h3', raw: '[1,2]', quarantined: 1 },
  { name: 'mão sem jogadores', key: H + 'h3', raw: edit((h) => delete h.players), quarantined: 1 },
  { name: 'mão com hero fora da mesa', key: H + 'h3', raw: edit((h) => (h.hero = 12)), quarantined: 1 },
  { name: 'mão com ação de um lugar que não existe', key: H + 'h3', raw: edit((h) => (h.actions = [{ p: 40, kind: 'call' }])), quarantined: 1 },
  { name: 'mão com carta inválida no board', key: H + 'h3', raw: edit((h) => (h.board = ['Zz'])), quarantined: 1 },
  { name: 'mão sem game', key: H + 'h3', raw: edit((h) => delete h.game), quarantined: 1 },
  {
    name: 'mão sem tags nem notas é reparada, não perdida',
    key: H + 'h3',
    raw: edit((h) => (delete h.tags, delete h.notes)),
    quarantined: 0,
    check: (d) => {
      const h = d.hands.items.find((x) => x.id === 'h3')!;
      assert.deepEqual(h.tags, []);
      assert.equal(h.notes, '');
    },
  },
  { name: 'índice das mãos cortado', key: SPECS.hands.index, raw: cut, quarantined: 1, check: (d) => assert.equal(d.hands.items.length, 30) },
  { name: 'índice das mãos é um objeto', key: SPECS.hands.index, raw: '{"a":1}', quarantined: 1, check: (d) => assert.equal(d.hands.items.length, 30) },
  { name: 'sessão com início que não é número', key: S + 's2', raw: edit((s) => (s.startedAt = 'ontem')), quarantined: 1 },
  {
    name: 'sessão sem pausas, registo de stack e mesa é reparada',
    key: S + 's2',
    raw: edit((s) => (delete s.breaks, delete s.stackLog, delete s.roster)),
    quarantined: 0,
    check: (d) => assert.deepEqual(d.sessions.items.find((s) => s.id === 's2')!.breaks, []),
  },
  { name: 'sessão com pausas que não são lista', key: S + 's2', raw: edit((s) => (s.breaks = 'x')), quarantined: 1 },
  { name: 'jogador sem etiquetas é reparado', key: SPECS.players.prefix + 'p1', raw: edit((p) => delete p.tags), quarantined: 0 },
  { name: 'viagem sem despesas é reparada', key: SPECS.trips.prefix + 't1', raw: edit((t) => delete t.expenses), quarantined: 0 },
  { name: 'bankroll ilegível', key: SPECS.bankrolls.prefix + 'br2', raw: cut, quarantined: 1 },
  {
    name: 'definições ilegíveis voltam aos valores de origem',
    key: KEYS.settings,
    raw: '{"inBB": tru',
    quarantined: 1,
    check: (d) => assert.equal(d.settings.currency, '€'),
  },
  {
    name: 'definições com um campo de tipo errado mantêm o resto',
    key: KEYS.settings,
    raw: edit((s) => (s.currency = 7)),
    quarantined: 1,
    check: (d) => {
      assert.equal(d.settings.currency, '€');
      assert.equal(d.settings.nickname, 'Rui');
      assert.equal(d.settings.bankrollId, 'br1');
    },
  },
  { name: 'definições que são uma lista', key: KEYS.settings, raw: '[]', quarantined: 1 },
  { name: 'rascunho cortado', key: KEYS.draft, raw: cut, quarantined: 1, check: (d) => assert.equal(d.draft, null) },
  { name: 'rascunho sem jogadores', key: KEYS.draft, raw: edit((h) => (h.players = [])), quarantined: 1, check: (d) => assert.equal(d.draft, null) },
];

for (const c of CASES) {
  test(`arranque com ${c.name}`, async () => {
    const r = current();
    const old = r.kv.data.get(c.key)!;
    const raw = typeof c.raw === 'string' ? c.raw : c.raw(old);
    r.kv.data.set(c.key, raw);
    const before = new Map(r.kv.data);

    const d = await launch(r.kv);
    exercise(d);
    assert.equal(d.quarantined, c.quarantined);
    const q = quarantineOf(r.kv);
    assert.equal(q.length, c.quarantined);
    if (c.quarantined) {
      // The exact bytes are kept, under a key that says where they came from.
      assert.ok(q[0][0].endsWith('.' + c.key));
      assert.equal(q[0][1], raw);
      assert.ok(keysToErase([q[0][0]]).length === 1, 'Apagar tudo also deletes quarantine');
    }

    // Everything that was readable is still there.
    const lostItem = c.quarantined && c.key.startsWith(H) ? 1 : 0;
    assert.equal(d.hands.items.length, 30 - lostItem);
    for (const [k, v] of before) {
      if (k === c.key || k.endsWith('.v2') || k.endsWith('.v1')) continue;
      assert.ok(r.kv.data.has(k), `${k} disappeared`);
      if (!k.startsWith(QUARANTINE) && k !== KEYS.settings) assert.equal(r.kv.data.get(k), v, `${k} changed`);
    }
    c.check?.(d);

    // Next launch is clean: nothing new in quarantine, no message again, same data.
    const again = await launch(r.kv);
    assert.equal(again.quarantined, 0);
    assert.equal(quarantineOf(r.kv).length, c.quarantined);
    for (const name of LISTS) assert.deepEqual(ids(again[name].items), ids(d[name].items), name);
    exercise(again);
  });
}

test('lista v1 com uma entrada estragada: as outras passam, a lista inteira fica de quarentena', async () => {
  const r = release1();
  const hands = JSON.parse(r.kv.data.get(SPECS.hands.legacy)!) as unknown[];
  hands[4] = { id: 'h4', players: 'oops' };
  hands[7] = 'lixo';
  const raw = JSON.stringify(hands);
  r.kv.data.set(SPECS.hands.legacy, raw);
  const d = await launch(r.kv);
  exercise(d);
  assert.equal(d.hands.items.length, 10);
  assert.equal(d.quarantined, 1);
  assert.deepEqual(quarantineOf(r.kv).map(([, v]) => v), [raw]);
  assert.ok(!r.kv.data.has(SPECS.hands.legacy));
  assert.equal((await loadAll(r.kv)).hands.items.length, 10);
});

test('lista v1 ilegível: vai inteira para quarentena e a app abre', async () => {
  const r = release1();
  r.kv.data.set(SPECS.sessions.legacy, '[{"id":"s0","kind":"mtt"');
  const d = await launch(r.kv);
  exercise(d);
  assert.equal(d.sessions.items.length, 0);
  assert.equal(d.hands.items.length, 12);
  assert.equal(d.quarantined, 1);
});

test('tudo estragado ao mesmo tempo: a app abre vazia e guarda tudo à parte', async () => {
  const r = current();
  const keys = [...r.kv.data.keys()];
  for (const k of keys) r.kv.data.set(k, '\u0000garbage' + k);
  const d = await launch(r.kv);
  exercise(d);
  assert.equal(d.hands.items.length, 0);
  assert.equal(d.quarantined, keys.length);
  assert.equal(quarantineOf(r.kv).length, keys.length);
  assert.equal((await launch(r.kv)).quarantined, 0);
});

test('sem espaço para a quarentena: nada é apagado e a app abre na mesma', async () => {
  const r = current();
  r.kv.data.set(H + 'h3', '{"id":"h3"');
  r.kv.failWrites = true;
  const d = await loadAll(r.kv);
  exercise(d);
  assert.equal(d.quarantined, 0);
  assert.equal(r.kv.data.get(H + 'h3'), '{"id":"h3"');
  assert.equal(d.hands.items.length, 29);
  // Space back: the next launch moves it.
  r.kv.failWrites = false;
  assert.equal((await launch(r.kv)).quarantined, 1);
});

test('o armazenamento falha a ler: a app abre e não apaga nada', async () => {
  const r = current();
  const kv = r.kv;
  const real = kv.getItem.bind(kv);
  kv.getItem = async (k: string) => {
    if (k === KEYS.settings || k === SPECS.sessions.index) throw new Error('Row too big to fit into CursorWindow');
    return real(k);
  };
  const d = await loadAll(kv);
  exercise(d);
  assert.equal(d.hands.items.length, 30);
  assert.ok(d.unreadable >= 1);
  assert.ok(kv.data.has(KEYS.settings));
});

// Random damage to stored hands and sessions: whatever the loader lets
// through, the screens must be able to show.
test('2.000 estragos aleatórios: o arranque nunca rebenta', async () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const pick = <T,>(l: T[]) => l[Math.floor(rand() * l.length)];
  const junk = () => pick<unknown>([null, undefined, 0, -1, 1e12, NaN, '', 'x', 'Zz', [], [null], {}, { p: 99 }, true, ['As', 'As'], [{ p: 0, kind: 'nope' }]]);
  const mutate = (x: unknown, depth = 0): unknown => {
    if (Array.isArray(x)) return rand() < 0.3 ? junk() : x.map((v) => (rand() < 0.2 ? mutate(v, depth + 1) : v));
    if (x && typeof x === 'object') {
      const o = { ...(x as Record<string, unknown>) };
      for (const k of Object.keys(o)) {
        const p = rand();
        if (k === 'id' && depth === 0) continue;
        if (p < 0.08) delete o[k];
        else if (p < 0.16) o[k] = junk();
        else if (p < 0.3) o[k] = mutate(o[k], depth + 1);
      }
      return o;
    }
    return rand() < 0.5 ? junk() : x;
  };
  for (let i = 0; i < 2000; i++) {
    const r = current();
    for (const k of [H + 'h' + (i % 30), S + 's' + (i % 5), KEYS.draft]) {
      const v = mutate(JSON.parse(r.kv.data.get(k)!));
      r.kv.data.set(k, rand() < 0.1 ? cut(JSON.stringify(v) ?? '') : (JSON.stringify(v) ?? 'undefined'));
    }
    let d: Boot;
    try {
      d = await loadAll(r.kv);
      exercise(d);
    } catch (e) {
      assert.fail(`case ${i}: ${(e as Error).stack}\n${r.kv.data.get(H + 'h' + (i % 30))}\n${r.kv.data.get(S + 's' + (i % 5))}\n${r.kv.data.get(KEYS.draft)}`);
    }
    assert.ok(d.hands.items.length >= 29, `case ${i}: lost more than the damaged hand`);
  }
});
