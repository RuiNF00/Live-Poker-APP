// Five years of a heavy live player, for the performance tests only: about
// 2,000 sessions, 10,000 hands, 50 backers with packages and payments, 300
// player notes. Deterministic (seeded), built in memory or in a FakeStorage;
// never written to a real phone.

import type { Hand } from '@/poker/types';

import { SPECS, KEYS } from '../boot';
import type { CollectionSpec } from '../persist';
import type { Backer, BackerPayment, Bankroll, PlayerNote, Session, StakePackage, Transfer } from '../types';
import { bigHistory, FakeStorage } from './fake-storage';
import { newSession } from './launch-fixtures';

const DAY = 86400000;
export const HEAVY_NOW = Date.UTC(2026, 9, 17, 12);

/** Small seeded PRNG (mulberry32): the same data on every run. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Heavy {
  sessions: Session[];
  hands: Hand[];
  players: PlayerNote[];
  bankrolls: Bankroll[];
  transfers: Transfer[];
  backers: Backer[];
  packages: StakePackage[];
  payments: BackerPayment[];
}

export function heavyData(opts: { sessions?: number; hands?: number; backers?: number } = {}): Heavy {
  const nS = opts.sessions ?? 2000;
  const nH = opts.hands ?? 10000;
  const nB = opts.backers ?? 50;
  const r = rng(42);
  const start = HEAVY_NOW - 5 * 365 * DAY;
  const step = (5 * 365 * DAY) / nS;

  const backers: Backer[] = Array.from({ length: nB }, (_, i) => ({ id: 'b' + i, name: 'Backer ' + i, note: '', createdAt: start + i * DAY, reminders: [] }));
  const packages: StakePackage[] = Array.from({ length: nB * 2 }, (_, i) => ({
    id: 'pk' + i,
    backerId: 'b' + (i % nB),
    name: 'Pacote ' + i,
    kind: i % 3 ? 'action' : 'makeup',
    share: 0.1 + (i % 5) * 0.1,
    markup: 1 + (i % 3) * 0.1,
    playerCut: 0.5,
    createdAt: start + i * 9 * DAY,
    ...(i < nB * 2 - 10 ? { closedAt: start + i * 9 * DAY + 60 * DAY } : {}),
  }));

  const bankrolls: Bankroll[] = [
    { id: 'br1', name: 'Principal', currency: '€', createdAt: start, updatedAt: 0 },
    { id: 'br2', name: 'Viagens $', currency: '$', createdAt: start + 1, updatedAt: 0 },
  ];

  const sessions: Session[] = [];
  for (let i = 0; i < nS; i++) {
    const base = newSession(i);
    const at = Math.round(HEAVY_NOW - (i + 1) * step);
    const cash = r() < 0.55;
    const usd = r() < 0.25;
    const buyIn = cash ? [200, 300, 500, 1000][i % 4] : [250, 550, 1100, 1650, 5300, 10000][i % 6];
    const cashOut = cash ? Math.max(0, Math.round(buyIn * (0.2 + r() * 1.9))) : r() < 0.15 ? Math.round(buyIn * (1 + r() * 12)) : 0;
    const hours = cash ? 3 + r() * 7 : 2 + r() * 10;
    const pkg = i % 7 === 0 ? packages[i % packages.length] : undefined;
    sessions.push({
      ...base,
      id: 's' + i,
      kind: cash ? 'cash' : 'mtt',
      name: cash ? ['1/2 NL', '2/5 NL', '5/10 NL', '2/5 PLO'][i % 4] : ['Main Event', 'High Roller', 'Turbo', 'Deepstack'][i % 4],
      venue: ['Casino Estoril', 'Casino Lisboa', 'Baha Mar', 'Aria', 'Rozvadov'][i % 5],
      currency: usd ? '$' : '€',
      bankrollId: usd ? 'br2' : 'br1',
      format: i % 10 === 0 ? 'online' : 'live',
      startedAt: at,
      endedAt: Math.round(at + hours * 3600000),
      breaks: [{ start: at + 3600000, end: at + 3900000 }],
      buyIn,
      entries: cash ? 1 + (i % 3 === 0 ? 1 : 0) : 1,
      cashOut,
      expenses: i % 4 === 0 ? 40 : 0,
      sb: cash ? [1, 2, 5, 2][i % 4] : 400,
      bb: cash ? [2, 5, 10, 5][i % 4] : 800,
      stackLog: Array.from({ length: 6 }, (_, k) => ({ t: at + k * 1800000, stack: 30000 + k * 1000, level: k + 1 })),
      staking: undefined,
      stakes: pkg ? [{ backerId: pkg.backerId, packageId: pkg.id, share: pkg.share, markup: pkg.markup }] : i % 11 === 0 ? [{ backerId: 'b' + (i % nB), share: 0.3, markup: 1.1 }] : [],
      updatedAt: at,
    } as Session);
  }

  const hands = bigHistory(nH, start).map((h, i) => {
    const s = sessions[Math.floor((i / nH) * nS)] ?? sessions[0];
    const at = HEAVY_NOW - Math.round(((i + 0.5) / nH) * 5 * 365 * DAY);
    return { ...h, id: 'h' + i, sessionId: s.id, createdAt: at, updatedAt: at };
  });

  const players: PlayerNote[] = Array.from({ length: 300 }, (_, i) => ({ id: 'p' + i, name: 'Jogador ' + i, look: '', tags: i % 4 ? ['Reg'] : [], notes: '', createdAt: start + i * DAY, updatedAt: start + i * DAY }));
  const transfers: Transfer[] = Array.from({ length: 120 }, (_, i) => ({ id: 'x' + i, bankrollId: i % 4 ? 'br1' : 'br2', kind: i % 3 ? 'deposit' : 'withdrawal', amount: 1000 + (i % 5) * 500, at: start + i * 15 * DAY, note: '' }));
  const payments: BackerPayment[] = Array.from({ length: nB * 6 }, (_, i) => ({ id: 'pay' + i, backerId: 'b' + (i % nB), amount: (i % 2 ? 1 : -1) * (100 + (i % 9) * 50), at: start + i * 6 * DAY, note: '', createdAt: start + i * 6 * DAY }));

  return { sessions, hands, players, bankrolls, transfers, backers, packages, payments };
}

function putList<T extends { id: string }>(kv: FakeStorage, spec: CollectionSpec, items: T[]) {
  for (const x of items) kv.data.set(spec.prefix + x.id, JSON.stringify(x));
  kv.data.set(spec.index, JSON.stringify(items.map((x) => x.id)));
}

/** The heavy data as the phone stores it, per-item keys. */
export function heavyStorage(d = heavyData()): FakeStorage {
  const kv = new FakeStorage();
  putList(kv, SPECS.hands, d.hands);
  putList(kv, SPECS.sessions, d.sessions);
  putList(kv, SPECS.players, d.players);
  putList(kv, SPECS.bankrolls, d.bankrolls);
  putList(kv, SPECS.transfers, d.transfers);
  putList(kv, SPECS.backers, d.backers);
  putList(kv, SPECS.packages, d.packages);
  putList(kv, SPECS.payments, d.payments);
  kv.data.set(KEYS.settings, JSON.stringify({ inBB: false, currency: '€', nickname: 'Rui', defaultTableSize: 9, onboarded: true, bankrollId: 'br1' }));
  return kv;
}
