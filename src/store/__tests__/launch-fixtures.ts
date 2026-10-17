// What a phone holds after each earlier version of the app, key by key, for
// the launch tests. Shapes are copied from the types of that version: each
// release only ever added optional fields and new keys.

import type { Hand } from '@/poker/types';

import { KEYS, SPECS } from '../boot';
import type { CollectionSpec } from '../persist';
import type { BackedPlayer, Backer, BackerPayment, Bankroll, PlayerNote, Session, StakePackage, Transfer, Trip } from '../types';
import { FakeStorage } from './fake-storage';

const T0 = Date.UTC(2026, 9, 1, 20);

/** A hand as the first release saved it (no folders, straddles, second board or voice note). */
export function oldHand(i: number, sessionId?: string): Hand {
  const at = T0 + i * 5 * 60000;
  return {
    v: 1,
    id: 'h' + i,
    createdAt: at,
    updatedAt: at,
    ...(sessionId ? { sessionId } : {}),
    game: { kind: 'mtt', name: 'Main Event', stage: 'mid', level: 8, sb: 400, bb: 800, ante: 800, anteType: 'bb', currency: '€' },
    players: [
      { name: 'Hero', stack: 42000, cards: ['As', 'Kd'] },
      { name: '', stack: 30000 },
      { name: 'Reg', stack: 61000, cards: ['Qc', 'Qh'] },
      { name: '', stack: 18000 },
      { name: '', stack: 25000 },
      { name: '', stack: 50000 },
    ],
    button: 5,
    hero: 0,
    actions: [
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
    ],
    board: ['Kh', '7c', '2d', '9s', '3h'],
    tags: i % 2 ? ['Value'] : [],
    notes: i % 3 ? '' : 'Ele só paga com pares médios.',
    ...(i % 4 === 0 ? { winners: [0] } : {}),
  };
}

/** A hand with what later releases added. */
export function newHand(i: number, sessionId?: string): Hand {
  const h = oldHand(i, sessionId);
  return {
    ...h,
    game: { ...h.game, anteType: 'btn', straddles: 0 },
    folders: i % 2 ? ['Rever com coach'] : undefined,
    title: 'Mão ' + i,
    shareId: i % 5 === 0 ? 'sh' + i : undefined,
    updatedAt: h.updatedAt + 1000,
  };
}

/** A session as the first release saved it (no updatedAt, staking, bankroll or format). */
export function oldSession(i: number): Session {
  const at = T0 - (i + 1) * 86400000;
  return {
    id: 's' + i,
    kind: i % 2 ? 'cash' : 'mtt',
    name: i % 2 ? '1/2 NL' : 'Main Event',
    venue: 'Casino Estoril',
    currency: '€',
    startedAt: at,
    endedAt: at + 6 * 3600000,
    breaks: [{ start: at + 3600000, end: at + 3900000 }],
    buyIn: i % 2 ? 200 : 550,
    entries: 1,
    addOn: 0,
    cashOut: i % 3 ? 0 : 1200,
    sb: 400,
    bb: 800,
    ante: 800,
    anteType: 'bb',
    level: 8,
    tableSize: 9,
    stack: 42000,
    stackLog: [{ t: at, stack: 30000, level: 1 }],
    roster: ['', 'Reg', '', '', '', '', '', '', ''],
    notes: '',
  };
}

export function newSession(i: number): Session {
  return {
    ...oldSession(i),
    staking: { sold: 0.3, markup: 1.1 },
    stakes: [{ backerId: 'b1', share: 0.3, markup: 1.1 }],
    bankrollId: 'br1',
    format: 'live',
    country: 'PT',
    tags: ['focado'],
    expenses: 40,
    docs: [],
    updatedAt: T0,
  } as Session;
}

const player = (i: number): PlayerNote => ({ id: 'p' + i, name: 'Jogador ' + i, look: 'boné azul', tags: ['Reg'], notes: '3-beta leve', createdAt: T0, updatedAt: T0 });

function putList<T extends { id: string }>(kv: FakeStorage, spec: CollectionSpec, items: T[]) {
  for (const x of items) kv.data.set(spec.prefix + x.id, JSON.stringify(x));
  kv.data.set(spec.index, JSON.stringify(items.map((x) => x.id)));
}

export interface Release {
  name: string;
  kv: FakeStorage;
  hands: number;
  sessions: number;
  players: number;
}

/** First release: every list is one JSON array (the v1 layout). */
export function release1(): Release {
  const kv = new FakeStorage();
  const sessions = [0, 1, 2].map(oldSession);
  const hands = Array.from({ length: 12 }, (_, i) => oldHand(i, sessions[i % 3].id));
  kv.data.set(SPECS.hands.legacy, JSON.stringify(hands));
  kv.data.set(SPECS.sessions.legacy, JSON.stringify(sessions));
  kv.data.set(SPECS.players.legacy, JSON.stringify([player(0), player(1)]));
  kv.data.set(KEYS.settings, JSON.stringify({ inBB: true, currency: '€', nickname: 'Rui', defaultTableSize: 6, onboarded: true }));
  kv.data.set(KEYS.draft, JSON.stringify({ ...oldHand(99), actions: [] }));
  return { name: 'v1: listas num só valor', kv, hands: 12, sessions: 3, players: 2 };
}

/** Per-item storage (each hand its own key), share settings, before bankrolls. */
export function release2(): Release {
  const kv = new FakeStorage();
  const sessions = [0, 1, 2, 3].map(oldSession).map((s) => ({ ...s, updatedAt: T0 }));
  putList(kv, SPECS.hands, Array.from({ length: 20 }, (_, i) => oldHand(i, sessions[i % 4].id)));
  putList(kv, SPECS.sessions, sessions);
  putList(kv, SPECS.players, [player(0), player(1), player(2)]);
  kv.data.set(KEYS.settings, JSON.stringify({ inBB: false, currency: '$', nickname: 'Rui', defaultTableSize: 9, onboarded: true, shareNames: true, shareNotes: false }));
  return { name: 'v2: um valor por mão', kv, hands: 20, sessions: 4, players: 3 };
}

/** Bankrolls, transfers and the first staking (one unnamed stake per session). */
export function release3(): Release {
  const r = release2();
  const sessions = [0, 1, 2, 3].map((i) => ({ ...oldSession(i), staking: { sold: 0.5, markup: 1.2 }, updatedAt: T0 }));
  putList(r.kv, SPECS.sessions, sessions);
  putList(r.kv, SPECS.bankrolls, [{ id: 'br1', name: 'Principal', currency: '€', createdAt: T0, updatedAt: 0 } satisfies Bankroll]);
  putList(r.kv, SPECS.transfers, [{ id: 'x1', bankrollId: 'br1', kind: 'deposit', amount: 5000, at: T0, note: '' } satisfies Transfer]);
  return { ...r, name: 'v3: bankrolls e staking simples' };
}

/** Everything the current version stores. */
export function current(): Release {
  const kv = new FakeStorage();
  const sessions = [0, 1, 2, 3, 4].map(newSession);
  putList(kv, SPECS.hands, Array.from({ length: 30 }, (_, i) => newHand(i, sessions[i % 5].id)));
  putList(kv, SPECS.sessions, sessions);
  putList(kv, SPECS.players, [player(0), player(1)]);
  putList(kv, SPECS.bankrolls, [
    { id: 'br1', name: 'Principal', currency: '€', createdAt: T0, updatedAt: 0 },
    { id: 'br2', name: 'Bankroll $', currency: '$', createdAt: T0 + 1, updatedAt: T0 },
  ] satisfies Bankroll[]);
  putList(kv, SPECS.transfers, [{ id: 'x1', bankrollId: 'br1', kind: 'deposit', amount: 5000, at: T0, note: '' } satisfies Transfer]);
  putList(kv, SPECS.backers, [{ id: 'b1', name: 'Zé', note: '', createdAt: T0, reminders: [] } satisfies Backer]);
  putList(kv, SPECS.packages, [{ id: 'pk1', backerId: 'b1', name: 'Bahamas', kind: 'makeup', share: 0.5, markup: 1, playerCut: 0.5, createdAt: T0 } satisfies StakePackage]);
  putList(kv, SPECS.payments, [{ id: 'pay1', backerId: 'b1', amount: 300, at: T0, note: '', createdAt: T0 } satisfies BackerPayment]);
  putList(kv, SPECS.trips, [{ id: 't1', name: 'Bahamas', venue: 'Baha Mar', currency: '$', from: T0, to: T0 + 15 * 86400000, expenses: [], createdAt: T0 } as unknown as Trip]);
  putList(kv, SPECS.backing, [{ id: 'bk1', statement: { v: 1, player: 'Ana' }, createdAt: T0 } as unknown as BackedPlayer]);
  kv.data.set(
    KEYS.settings,
    JSON.stringify({ inBB: false, currency: '€', nickname: 'Rui', defaultTableSize: 9, onboarded: true, shareNames: false, shareNotes: true, bankrollId: 'br1', hideAmounts: false, streakPauses: [{ from: T0 }] }),
  );
  kv.data.set(KEYS.draft, JSON.stringify(newHand(98)));
  return { name: 'atual', kv, hands: 30, sessions: 5, players: 2 };
}

/** An update killed half-way through moving v1 to per-item keys: some hands in both places, no v2 index yet. */
export function interrupted(): Release {
  const r = release1();
  const hands = JSON.parse(r.kv.data.get(SPECS.hands.legacy)!) as Hand[];
  for (const h of hands.slice(0, 5)) r.kv.data.set(SPECS.hands.prefix + h.id, JSON.stringify(h));
  return { ...r, name: 'migração v1 → v2 interrompida' };
}

export const RELEASES = [release1, release2, release3, current, interrupted];
