/// <reference types="node" />
// Updating the app must never lose data. Each fixture below is a value as an
// older build actually wrote it, shape by shape from that build's types in git
// history (the commit is named on each one), not the current types with fields
// left out. They go through the real launch path (loadAll, then the write-back
// StoreProvider does) on an in-memory storage, and every stored field must come
// out as it went in: nothing quarantined, dropped or reset.
//
// The stores outside the main boot (festival plans, own festivals, weekly
// tournaments, swaps, the outbox) and the app lock read the same fixtures from
// their own keys.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { USED_INSTALL_KEYS, lockIsThisInstalls } from '@/lib/app-lock-core';
import { createOutbox } from '@/lib/outbox';
import { isComplete, replay } from '@/poker/engine';

import { ensureBankrolls } from '../bankroll-math';
import { KEYS, QUARANTINE, SPECS, loadAll, type Boot } from '../boot';
import { createWriter, loadCollection, type CollectionSpec } from '../persist';
import { profit, totals } from '../session-math';
import { withCuts } from '../staking';
import { FakeStorage } from './fake-storage';

type Obj = Record<string, unknown>;
const T = Date.UTC(2026, 9, 17, 20);
const H = 3600_000;
const LISTS = Object.keys(SPECS) as (keyof typeof SPECS)[];

// ─── Hands ───────────────────────────────────────────────────────────────────

// The same street-by-street action for every 6-handed fixture (as entered in the first build).
const ACTIONS6 = [
  { p: 2, kind: 'raise', to: 1800 },
  { p: 3, kind: 'fold' },
  { p: 4, kind: 'fold' },
  { p: 5, kind: 'fold' },
  { p: 0, kind: 'raise', to: 6000 },
  { p: 1, kind: 'fold' },
  { p: 2, kind: 'call' },
  { p: 0, kind: 'bet', to: 5000 },
  { p: 2, kind: 'call' },
  { p: 0, kind: 'check' },
  { p: 2, kind: 'check' },
  { p: 0, kind: 'bet', to: 12000 },
  { p: 2, kind: 'fold' },
];
const PLAYERS6 = [
  { name: 'Hero', stack: 42000, cards: ['As', 'Kd'] },
  { name: '', stack: 30000 },
  { name: 'Reg', stack: 61000, cards: ['Qc', 'Qh'], playerId: 'p1' },
  { name: '', stack: 18000 },
  { name: '', stack: 25000 },
  { name: '', stack: 50000 },
];

/** e6bc7104 (first build, poker/types.ts of 41cebc90): Hand v1, every GameInfo field of then, anteType 'all'. */
const handE6 = (id: string, sessionId?: string): Obj => ({
  v: 1,
  id,
  createdAt: T - 20 * H,
  updatedAt: T - 20 * H,
  ...(sessionId ? { sessionId } : {}),
  game: { kind: 'mtt', name: 'Main Event', stage: 'bubble', level: 12, sb: 400, bb: 800, ante: 100, anteType: 'all', currency: '€', buyIn: 550, playersLeft: 48, venue: 'Casino Estoril' },
  players: PLAYERS6,
  button: 5,
  hero: 0,
  actions: ACTIONS6,
  board: ['Kh', '7c', '2d', '9s', '3h'],
  tags: ['Value', 'Bolha'],
  notes: 'Ele só paga com pares médios.',
  title: 'AK na bolha',
  winners: [0],
  shareId: 'sh1',
  shareToken: 'tok1',
});

/** e6bc7104: a cash hand, no stage or level, board run out to the turn only, no winners. */
const cashHandE6 = (id: string): Obj => ({
  v: 1,
  id,
  createdAt: T - 19 * H,
  updatedAt: T - 19 * H,
  game: { kind: 'cash', name: '1/2 NL', sb: 1, bb: 2, ante: 0, anteType: 'none', currency: '€' },
  players: [
    { name: 'Hero', stack: 200, cards: ['9h', '9d'] },
    { name: 'Tó', stack: 340 },
  ],
  button: 0,
  hero: 0,
  actions: [
    { p: 0, kind: 'raise', to: 6 },
    { p: 1, kind: 'call' },
    { p: 1, kind: 'check' },
    { p: 0, kind: 'bet', to: 8 },
    { p: 1, kind: 'call' },
    { p: 1, kind: 'check' },
    { p: 0, kind: 'check' },
  ],
  board: ['2c', '7d', 'Js', 'Qd'],
  tags: [],
  notes: '',
});

/** Per-item builds of 17 Oct (fec2c627 voice note, d9467df4 folders, a83b3c4b straddles/btn ante/bomb pot, a88400da run it twice). */
const handMid = (id: string, sessionId: string): Obj => ({
  ...handE6(id, sessionId),
  createdAt: T - 10 * H,
  updatedAt: T - 9 * H,
  game: { kind: 'mtt', name: 'Main Event', stage: 'mid', level: 8, sb: 400, bb: 800, ante: 800, anteType: 'btn', currency: '€', straddles: 1, straddleFrom: 'utg' },
  folders: ['Rever com coach'],
  voiceNote: 'voice-h1.m4a',
  board2: ['Kh', '7c', '2d', 'Ts', '4c'],
  winners2: [0],
});

/** Last builds before the store build (a156b8ae street notes, 1453bfba review state, 77b056af ask, bomb pot). */
const handLate = (id: string, sessionId: string): Obj => ({
  ...handE6(id, sessionId),
  createdAt: T - 2 * H,
  updatedAt: T - H,
  game: { kind: 'mtt', name: 'Bounty', level: 3, sb: 100, bb: 200, ante: 200, anteType: 'bb', currency: '$', bombPot: 2 },
  streetNotes: { flop: 'Devia ter apostado mais', river: 'Fold certo?' },
  review: 'reviewed',
  reviewNote: 'Ok.',
  reviewedAt: T,
  ask: 'Bet ou check no river?',
});

/** e6bc7104 draft (store.setDraft every tap): no action yet, one hero card picked. */
const draftE6: Obj = {
  v: 1,
  id: 'draft1',
  createdAt: T,
  updatedAt: T,
  game: { kind: 'mtt', name: '', sb: 100, bb: 200, ante: 0, anteType: 'none', currency: '€' },
  players: Array.from({ length: 9 }, (_, i) => (i === 0 ? { name: '', stack: 20000, cards: ['Ah'] } : { name: '', stack: 20000 })),
  button: 0,
  hero: 0,
  actions: [],
  board: [],
  tags: [],
  notes: '',
};

// ─── Sessions ────────────────────────────────────────────────────────────────

/** e6bc7104 Session: no updatedAt, staking, bankroll, format, tags or docs. */
const sessionE6 = (id: string, kind: 'mtt' | 'cash' = 'mtt'): Obj => ({
  id,
  kind,
  name: kind === 'mtt' ? 'Main Event' : '1/2 NL',
  venue: 'Casino Estoril',
  currency: '€',
  startedAt: T - 30 * H,
  endedAt: T - 24 * H,
  breaks: [{ start: T - 28 * H, end: T - 27.5 * H }],
  buyIn: kind === 'mtt' ? 550 : 200,
  entries: 2,
  addOn: 0,
  cashOut: 1800,
  ...(kind === 'mtt' ? { finish: 7, field: 312 } : {}),
  sb: 400,
  bb: 800,
  ante: 800,
  anteType: 'bb',
  level: 14,
  stage: 'itm',
  tableSize: 9,
  stack: 42000,
  stackLog: [
    { t: T - 30 * H, stack: 30000, level: 1 },
    { t: T - 26 * H, stack: 42000 },
  ],
  roster: ['', 'Reg', '', '', '', '', '', '', ''],
  notes: 'Mesa dura.',
});

/** 3aa9ef17 (still the v1 layout): one unnamed stake, expenses, updatedAt. */
const session3a = (id: string): Obj => ({ ...sessionE6(id), staking: { sold: 0.25, markup: 1.15 }, expenses: 80, updatedAt: T - 24 * H });

/** Per-item builds of 17 Oct: 13b482d5 bankroll/format, 0bb46b44 stakes + live link (no showVenue yet), c841f7b3 level clock, 6f32e717 tags, cd26002c taxes, ae6bbaa4 multi-day, d85e9fb0 swapNet. */
const sessionMid = (id: string): Obj => ({
  ...session3a(id),
  bankrollId: 'br1',
  format: 'live',
  stakes: [
    { backerId: 'b1', share: 0.2, markup: 1.1 },
    { packageId: 'pk1', backerId: 'b1', share: 0.1, markup: 1, unpaid: true },
    { share: 0.05, markup: 1.2 },
  ],
  live: { id: 'lv1', token: 't0k' },
  makeupCut: 120,
  levelMinutes: 40,
  levelStartedAt: T - 25 * H,
  tags: ['focado', 'cansado'],
  country: 'US',
  withheld: { amount: 300, form: '1042-S', status: 'recover' },
  docs: [{ id: 'doc1', name: 'Recibo', file: 'doc1.jpg', kind: 'receipt', addedAt: T - 24 * H }],
  day: 2,
  bag: { stack: 88000, at: T - 24 * H },
  swapNet: -40,
});

/** Last builds before the store build: a5bc9fdf tourney, 2256b18e tips/hands, 4978daa4 mind, 697d4aa9 fileCut, a running cash game. */
const sessionLate = (id: string): Obj => {
  const { endedAt: _e, finish: _f, field: _fl, ...running } = sessionMid(id) as Obj & { endedAt: number; finish: number; field: number };
  return {
    ...running,
    tourney: {
      structure: [
        { sb: 100, bb: 200, ante: 200, minutes: 30 },
        { sb: 200, bb: 400, ante: 400, minutes: 30, breakAfter: 15 },
      ],
      structureName: 'standard',
      entries: 312,
      left: 40,
      startStack: 30000,
      payouts: [10000, 6000, 4000],
      bounties: 250,
    },
    tips: 20,
    handsDealt: 240,
    mind: { energy: 4, focus: 3, sleep: 7.5, mood: 'bem', tilt: 2, note: 'Calmo' },
    fileCut: 50,
    live: { id: 'lv2', token: 't0k2', showVenue: false },
  };
};

// ─── Everything else in the main store ───────────────────────────────────────

const playerE6 = (id: string): Obj => ({ id, name: 'Boné azul', look: 'boné azul, relógio', tags: ['Reg', 'Agressivo'], notes: '3-beta leve', createdAt: T - 40 * H, updatedAt: T - 40 * H });
/** 13b482d5 */
const bankroll13 = { id: 'br1', name: 'Principal', currency: '€', createdAt: T - 30 * H };
const transfer13 = { id: 'x1', bankrollId: 'br1', kind: 'deposit', amount: 5000, at: T - 30 * H, note: '' };
/** 0bb46b44: Backer without reminders/page, package without makeupIn/currency. */
const backer0b = { id: 'b1', name: 'Zé', note: '', createdAt: T - 30 * H };
const package0b = { id: 'pk1', backerId: 'b1', name: 'Bahamas', kind: 'makeup', share: 0.5, markup: 1, playerCut: 0.5, createdAt: T - 30 * H };
const payment0b = { id: 'pay1', backerId: 'b1', amount: 300, at: T - 20 * H, note: 'MB Way', createdAt: T - 20 * H };
/** 9a7a1e51: a trip with expenses (one paid in another currency) and its festival. */
const trip9a = {
  id: 't1',
  name: 'Bahamas',
  venue: 'Baha Mar',
  currency: '$',
  from: T,
  to: T + 15 * 24 * H,
  fx: { currency: '€', rate: 0.92 },
  festivalId: 'bahamas-dez-2026',
  expenses: [
    { id: 'e1', kind: 'flight', amount: 900, currency: '€', at: T, note: 'TAP' },
    { id: 'e2', kind: 'hotel', amount: 1400, currency: '$', at: T, note: '' },
  ],
  createdAt: T - 10 * H,
};
/** 82874652: a backer's saved statement, before yr/cu/nx/lv existed. */
const backed82 = {
  id: 'bk1',
  statement: {
    v: 1,
    id: 'k1',
    pl: 'Ana',
    bk: 'Rui',
    cur: '€',
    at: T,
    bal: 120,
    mk: 0,
    inv: 500,
    res: 620,
    rows: [{ d: T - 30 * H, e: T - 24 * H, n: 'Main Event', k: 'mtt', sh: 0.2, mu: 1.1, c: 121, o: 360, p: 'Bahamas', l: 'lv1' }],
  },
  shareKey: 'sk1',
  createdAt: T - 5 * H,
};

// ─── Settings ────────────────────────────────────────────────────────────────

/** e6bc7104 DEFAULT_SETTINGS keys only. */
const settingsE6 = { inBB: true, currency: '$', nickname: 'Rui', defaultTableSize: 6, onboarded: true };
/** de26bfa6 + 13b482d5 + 89e67b55 + 665d206f + d85e9fb0 (shareNotes was still true by default then). */
const settingsMid = { ...settingsE6, shareNames: true, shareNotes: true, bankrollId: 'br1', hideAmounts: true, streakPauses: [{ from: T - 100 * H, to: T - 50 * H }, { from: T }], includeSwaps: false };
/** Everything up to the store build. */
const settingsLate = {
  ...settingsMid,
  mindAsk: false,
  widgetResult: true,
  fxManual: { ARS: 1050.5 },
  haptics: false,
  sizes: { mtt: { open: 2.2, bet: 0.33 }, cash: { open: 4, threeBet: 3 } },
  monthRecap: false,
  notifyAmounts: true,
  yearRecapSent: 2025,
  yearRecapAt: T,
  notify: { trial: false, streak: true },
  notifyHoldInSession: false,
  icm: true,
};

// ─── Phones ──────────────────────────────────────────────────────────────────

type Phone = { name: string; kv: FakeStorage; lists: Partial<Record<keyof typeof SPECS, Obj[]>>; settings: Obj; draft?: Obj };

function putList(kv: FakeStorage, spec: CollectionSpec, items: Obj[]) {
  for (const x of items) kv.data.set(spec.prefix + x.id, JSON.stringify(x));
  kv.data.set(spec.index, JSON.stringify(items.map((x) => x.id)));
}

/** e6bc7104: every list one JSON array under its v1 key. */
function phoneE6(): Phone {
  const kv = new FakeStorage();
  const sessions = [sessionE6('s1'), sessionE6('s2', 'cash')];
  const hands = [handE6('h1', 's1'), handE6('h2', 's1'), cashHandE6('h3')];
  const players = [playerE6('p1'), playerE6('p2')];
  kv.data.set(SPECS.hands.legacy, JSON.stringify(hands));
  kv.data.set(SPECS.sessions.legacy, JSON.stringify(sessions));
  kv.data.set(SPECS.players.legacy, JSON.stringify(players));
  kv.data.set(KEYS.settings, JSON.stringify(settingsE6));
  kv.data.set(KEYS.draft, JSON.stringify(draftE6));
  return { name: 'e6bc7104 (primeira versão, listas v1)', kv, lists: { hands, sessions, players }, settings: settingsE6, draft: draftE6 };
}

/** 3aa9ef17: still the v1 layout, sessions with staking and expenses. */
function phone3a(): Phone {
  const r = phoneE6();
  const sessions = [session3a('s1'), sessionE6('s2', 'cash'), session3a('s3')];
  r.kv.data.set(SPECS.sessions.legacy, JSON.stringify(sessions));
  return { ...r, name: '3aa9ef17 (staking simples, ainda v1)', lists: { ...r.lists, sessions } };
}

/** Per-item builds of 17 Oct, before launch validation (43d8b557): every collection, no fix-ups ever written. */
function phoneMid(): Phone {
  const kv = new FakeStorage();
  const lists: Phone['lists'] = {
    hands: [handE6('h1', 's1'), handMid('h2', 's2'), cashHandE6('h3')],
    sessions: [sessionE6('s1'), sessionMid('s2'), session3a('s3')],
    players: [playerE6('p1')],
    bankrolls: [bankroll13],
    transfers: [transfer13],
    backers: [backer0b],
    packages: [package0b],
    payments: [payment0b],
    trips: [trip9a],
    backing: [backed82],
  };
  for (const name of LISTS) if (lists[name]) putList(kv, SPECS[name], lists[name]!);
  kv.data.set(KEYS.settings, JSON.stringify(settingsMid));
  return { name: 'per-item de 17 out (antes da validação)', kv, lists, settings: settingsMid };
}

/** The TestFlight builds right before the store build: everything the old types allowed, plus a v1 key left by an interrupted migration. */
function phoneLate(): Phone {
  const r = phoneMid();
  const sessions = [...r.lists.sessions!, sessionLate('s4')];
  const hands = [...r.lists.hands!, handLate('h4', 's4')];
  putList(r.kv, SPECS.sessions, sessions);
  putList(r.kv, SPECS.hands, hands);
  // A trip from a build that never wrote expenses (defensive: 9a7a1e51 always did).
  const trips = [...r.lists.trips!, { id: 't2', name: 'Estoril', venue: 'Casino Estoril', currency: '€', from: T, to: T + 3 * 24 * H, createdAt: T }];
  putList(r.kv, SPECS.trips, trips);
  // An update killed between writing the per-item keys and removing the v1 array.
  r.kv.data.set(SPECS.players.legacy, JSON.stringify(r.lists.players));
  r.kv.data.set(KEYS.settings, JSON.stringify(settingsLate));
  r.kv.data.set(KEYS.draft, JSON.stringify({ ...handLate('draft2', 's4'), actions: ACTIONS6.slice(0, 4), board: [] }));
  return { ...r, name: 'TestFlight antes da build da loja', lists: { ...r.lists, sessions, hands, trips }, settings: settingsLate, draft: { ...handLate('draft2', 's4'), actions: ACTIONS6.slice(0, 4), board: [] } };
}

const PHONES = [phoneE6, phone3a, phoneMid, phoneLate];

/** What StoreProvider does at launch: read, write back what isn't in the current layout, save settings. */
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

/** Every field the old build stored is there with the same value (new fields may be added). */
function keeps(loaded: unknown, stored: Obj, what: string) {
  assert.ok(loaded && typeof loaded === 'object', `${what}: missing`);
  for (const [k, v] of Object.entries(stored)) assert.deepEqual((loaded as Obj)[k], v, `${what}.${k}`);
}

function keepsAll(d: Boot, p: Phone) {
  for (const name of LISTS) {
    const stored = p.lists[name] ?? [];
    const got = d[name].items as unknown as Obj[];
    if (name !== 'bankrolls') assert.equal(got.length, stored.length, `${p.name}: ${name} count`);
    for (const x of stored) keeps(got.find((y) => y.id === x.id), x, `${name}.${x.id as string}`);
  }
  keeps(d.settings, p.settings, 'settings');
  if (p.draft) keeps(d.draft, p.draft, 'draft');
  else assert.equal(d.draft, null);
}

const quarantineKeys = (kv: FakeStorage) => [...kv.data.keys()].filter((k) => k.startsWith(QUARANTINE));

for (const make of PHONES) {
  test(`atualizar a partir de ${make().name}: nada vai para quarentena, nada se perde`, async () => {
    const p = make();
    const d = await launch(p.kv);
    assert.equal(d.quarantined, 0);
    assert.equal(d.unreadable, 0);
    assert.equal(d.recovered, 0);
    assert.deepEqual(d.quarantine, []);
    assert.deepEqual(quarantineKeys(p.kv), []);
    keepsAll(d, p);

    // What the first screens compute from it doesn't throw.
    for (const h of [...d.hands.items, ...(d.draft ? [d.draft] : [])]) isComplete(h, replay(h));
    const sessions = withCuts(d.sessions.items, d.packages.items);
    sessions.forEach(profit);
    totals(sessions);
    for (const s of sessions) void (s.breaks.length + s.stackLog.length + s.roster.length);
    for (const t of d.trips.items) void t.expenses.length;

    // v1 keys are gone once moved, and the next launch reads the same values from the current layout.
    for (const name of ['hands', 'sessions', 'players'] as const) assert.ok(!p.kv.data.has(SPECS[name].legacy), `${name} v1 key left`);
    const again = await loadAll(p.kv);
    assert.equal(again.quarantined, 0);
    keepsAll(again, p);
    for (const name of LISTS) assert.deepEqual(again[name].persisted, again[name].items, `${name} fully on disk`);
  });
}

test('versão antiga: o que falta é preenchido, nunca reposto por cima do que havia', async () => {
  const d = await launch(phoneE6().kv);
  const s = d.sessions.items.find((x) => x.id === 's1')!;
  assert.equal(s.finish, 7);
  assert.equal(s.stage, 'itm');
  const h = d.hands.items.find((x) => x.id === 'h1')!;
  assert.equal(h.game.anteType, 'all');
  assert.equal(h.game.playersLeft, 48);
  assert.equal(d.settings.shareNames, false); // didn't exist: the default
  assert.equal(d.settings.inBB, true); // did: kept
  assert.deepEqual(d.draft?.players[0].cards, ['Ah']);
});

// ─── Stores with their own keys ──────────────────────────────────────────────

/** A localStorage for the web AsyncStorage that the module-level stores use. */
function webStorage(seed: Record<string, unknown>): Map<string, string> {
  const m = new Map(Object.entries(seed).map(([k, v]) => [k, JSON.stringify(v)]));
  const ls = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    key: (i: number) => [...m.keys()][i] ?? null,
    clear: () => m.clear(),
    get length() {
      return m.size;
    },
  };
  (globalThis as { window?: unknown }).window = { localStorage: ls };
  return m;
}
const settle = () => new Promise((r) => setTimeout(r, 20));

test('planos de festival, festivais próprios e torneios semanais de versões antigas leem-se inteiros', async () => {
  // b67194ce: picked, lateReg, sessions only. 1f53e200 adds a name, 552be9d2 the player's own events.
  const plans = {
    'bahamas-dez-2026': { picked: ['1', '4-A'], lateReg: { '1': 180 }, sessions: { '1': 's1' } },
    'las-vegas-dez-2026': { picked: [], lateReg: {}, sessions: {}, name: 'Vegas com a Ana' },
    'estoril-may-2027': {
      picked: ['own1'],
      lateReg: {},
      sessions: {},
      events: [{ id: 'own1', number: 100_001, name: 'Side event', unnumbered: true, game: 'NLH', buyIn: 150, guarantee: 0, start: '2027-05-03T20:00', own: true }],
    },
  };
  // 8bd5e249: no tz yet, offset from the day it was added.
  const mine = [
    { id: 'fx_1', name: 'Malta, novembro 2026', venue: 'St. Julian’s', city: '', currency: '€', utcOffset: 60, source: { label: '', checked: '2026-10-17' }, notes: [], events: [], dates: { from: '2026-11-05', to: '2026-11-12' }, own: true },
  ];
  // 298da01b
  const weekly = [{ id: 'wk_1', name: 'Quinta 60€', venue: 'Casino Lisboa', currency: '€', weekday: 4, time: '21:00', buyIn: 60, stack: 20000, levelMinutes: 20 }];
  const m = webStorage({ 'rl.festivalPlans.v1': plans, 'rl.myFestivals.v1': mine, 'rl.weekly.v1': weekly });

  const fp = await import('../festival-plan');
  const mf = await import('../my-festivals');
  const wk = await import('../weekly');
  fp.currentPlans();
  mf.currentOwnFestivals();
  wk.currentWeekly();
  await settle();
  assert.deepEqual(fp.currentPlans(), plans);
  assert.deepEqual(mf.currentOwnFestivals(), mine);
  assert.deepEqual(mf.festivalById('fx_1'), mine[0]);
  assert.deepEqual(wk.currentWeekly(), weekly);

  // A change after the update keeps every other plan on disk.
  fp.updatePlan('bahamas-dez-2026', (p) => fp.togglePicked(p, '2'));
  await settle();
  const saved = JSON.parse(m.get('rl.festivalPlans.v1')!);
  assert.deepEqual(saved['las-vegas-dez-2026'], plans['las-vegas-dez-2026']);
  assert.deepEqual(saved['estoril-may-2027'], plans['estoril-may-2027']);
  assert.deepEqual(saved['bahamas-dez-2026'].picked, ['1', '4-A', '2']);
});

test('swaps de a03c6093 e trabalhos por enviar no outbox passam a atualização', async () => {
  const kv = new FakeStorage();
  const spec: CollectionSpec = { index: 'rl.swaps.v1', prefix: 'rl.swap.v1.' };
  const swap = {
    id: 'Ab12Cd34',
    token: 'f'.repeat(64),
    side: 'a',
    terms: { v: 1, scope: 'event', title: 'Main Event', venue: 'Estoril', currency: '€', a: { name: 'Rui', pct: 5 }, b: { name: 'Ana', pct: 5 }, note: '', createdAt: T },
    confirmedAt: T,
    confirmedName: 'Ana',
    entries: [{ id: 'e1', cid: 'c1', side: 'a', kind: 'result', event: 'Main Event', amount: 1000, finish: 7, at: T, pending: true }],
    createdAt: T,
    updatedAt: T,
  };
  putList(kv, spec, [swap]);
  const l = await loadCollection(kv, spec);
  assert.deepEqual(l.items, [swap]);
  assert.deepEqual(l.bad, []);

  // 63633a4f Job shape; a share upload still waiting for signal.
  const job = { id: 'j1', kind: 'share-upload', key: 'h1', payload: { handId: 'h1' }, tries: 3, nextAt: T, createdAt: Date.now() - H };
  const mem = new Map([['rl.outbox.v1', JSON.stringify([job])]]);
  const ob = createOutbox({ getItem: async (k) => mem.get(k) ?? null, setItem: async (k, v) => void mem.set(k, v) }, { 'share-upload': async () => 'retry' });
  assert.equal(await ob.size(), 1);
  assert.equal(await ob.has('share-upload', 'h1'), true);
});

test('bloqueio da app ligado numa versão antes da marca de instalação continua ligado', () => {
  // The keys it looks for are the main store's own.
  for (const name of ['hands', 'sessions', 'players'] as const) {
    assert.ok(USED_INSTALL_KEYS.includes(SPECS[name].index));
    assert.ok(USED_INSTALL_KEYS.includes(SPECS[name].legacy));
  }
  // Before 6a33a99f there was no marker: a lock next to this install's own data is kept.
  assert.equal(lockIsThisInstalls(null, [['rl.hands.v2', '["h1"]'], ['rl.sessions.v2', null]]), true);
  assert.equal(lockIsThisInstalls(null, [['rl.sessions.v1', '[]']]), true);
  // A reinstall: the keychain kept the lock, the app's storage is empty.
  assert.equal(lockIsThisInstalls(null, USED_INSTALL_KEYS.map((k) => [k, null] as const)), false);
  assert.equal(lockIsThisInstalls('1', []), true);
});
