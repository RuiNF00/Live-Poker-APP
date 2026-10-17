// Local-first store: everything lives on the device (AsyncStorage) so the app
// works with no account and no signal in a card room. Sharing is the only
// thing that touches the network.

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';

import { t } from '@/i18n';

import type { Hand } from '@/poker/types';

import { mergeById, type BackupData } from './backup';
import { createWriter, loadCollection, type CollectionSpec, type KV } from './persist';
import { withCuts } from './staking';
import { DEFAULT_SETTINGS, type Backer, type BackerPayment, type PlayerNote, type Session, type Settings, type StakePackage } from './types';

const KEYS = {
  settings: 'rl.settings.v1',
  draft: 'rl.draft.v1',
};

const SPECS = {
  hands: { index: 'rl.hands.v2', prefix: 'rl.hand.v2.', legacy: 'rl.hands.v1' },
  sessions: { index: 'rl.sessions.v2', prefix: 'rl.session.v2.', legacy: 'rl.sessions.v1' },
  players: { index: 'rl.players.v2', prefix: 'rl.player.v2.', legacy: 'rl.players.v1' },
  backers: { index: 'rl.backers.v1', prefix: 'rl.backer.v1.' },
  packages: { index: 'rl.packages.v1', prefix: 'rl.package.v1.' },
  payments: { index: 'rl.payments.v1', prefix: 'rl.payment.v1.' },
} satisfies Record<string, CollectionSpec>;

export function uid(prefix = ''): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

interface StoreValue {
  ready: boolean;
  hands: Hand[];
  sessions: Session[];
  players: PlayerNote[];
  backers: Backer[];
  packages: StakePackage[];
  payments: BackerPayment[];
  settings: Settings;
  activeSession: Session | null;
  saveHand: (h: Hand) => void;
  deleteHand: (id: string) => void;
  saveSession: (s: Session) => void;
  deleteSession: (id: string) => void;
  savePlayer: (p: PlayerNote) => void;
  deletePlayer: (id: string) => void;
  saveBacker: (b: Backer) => void;
  /** Removes the backer, their packages and payments; their stakes in sessions stay, unnamed. */
  deleteBacker: (id: string) => void;
  savePackage: (p: StakePackage) => void;
  deletePackage: (id: string) => void;
  savePayment: (p: BackerPayment) => void;
  deletePayment: (id: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  draft: Hand | null;
  setDraft: (h: Hand | null) => void;
  /** Merge a backup in: newer copy of each item wins, nothing local is deleted. */
  importData: (b: BackupData) => { hands: number; sessions: number; players: number; backers: number };
}

const Ctx = createContext<StoreValue | null>(null);

async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

let warned = false;
/** Tell the player once per launch: a save that silently fails is lost work. */
function storageFailed(e: unknown) {
  console.warn('[store] write failed', e);
  if (warned) return;
  warned = true;
  Alert.alert(
    t('Não foi possível guardar'),
    t('O telemóvel recusou gravar os dados (pouco espaço livre?). Tenta libertar espaço; a app volta a tentar sozinha.'),
  );
}

function persist(key: string, value: unknown) {
  AsyncStorage.setItem(key, JSON.stringify(value)).catch(storageFailed);
}

const kv = AsyncStorage as unknown as KV;

function loadAll() {
  const t0 = Date.now();
  return Promise.all([
    loadCollection<Hand>(kv, SPECS.hands),
    loadCollection<Session>(kv, SPECS.sessions),
    loadCollection<PlayerNote>(kv, SPECS.players),
    load<Settings>(KEYS.settings, DEFAULT_SETTINGS),
    load<Hand | null>(KEYS.draft, null),
    loadCollection<Backer>(kv, SPECS.backers),
    loadCollection<StakePackage>(kv, SPECS.packages),
    loadCollection<BackerPayment>(kv, SPECS.payments),
  ]).then(([hands, sessions, players, settings, draft, backers, packages, payments]) => ({
    hands,
    sessions,
    players,
    settings,
    draft,
    backers,
    packages,
    payments,
    ms: Date.now() - t0,
  }));
}

// Start reading as soon as the bundle runs, in parallel with fonts and the
// first render, instead of after them.
let boot: ReturnType<typeof loadAll> | null = loadAll();

/** 0 none, 1 empty draft, 2 a draft with something in it (what the hands list shows). */
function draftKeyOf(h: Hand | null): number {
  if (!h) return 0;
  return h.actions.length || h.players[h.hero]?.cards?.length ? 2 : 1;
}

/** A session as stored: without the derived makeup cut. */
function bare(s: Session): Session {
  if (s.makeupCut === undefined) return s;
  const { makeupCut: _, ...rest } = s;
  return rest;
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i < 0) return [item, ...list];
  const copy = [...list];
  copy[i] = item;
  return copy;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [hands, setHands] = useState<Hand[]>([]);
  const [rawSessions, setSessions] = useState<Session[]>([]);
  const [players, setPlayers] = useState<PlayerNote[]>([]);
  const [backers, setBackers] = useState<Backer[]>([]);
  const [packages, setPackages] = useState<StakePackage[]>([]);
  const [payments, setPayments] = useState<BackerPayment[]>([]);
  // What screens see: each session with its makeup package cut (derived, never stored).
  const sessions = useMemo(() => withCuts(rawSessions, packages), [rawSessions, packages]);
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  // The draft changes on every tap of hand entry. Keeping it in a ref (and
  // re-rendering only when 'is there a draft worth resuming' flips) stops
  // every screen behind the entry modal from re-rendering on each tap.
  const draftRef = useRef<Hand | null>(null);
  const [draftKey, setDraftKey] = useState(0);
  const writers = useRef<{
    hands: ReturnType<typeof createWriter<Hand>>;
    sessions: ReturnType<typeof createWriter<Session>>;
    players: ReturnType<typeof createWriter<PlayerNote>>;
    backers: ReturnType<typeof createWriter<Backer>>;
    packages: ReturnType<typeof createWriter<StakePackage>>;
    payments: ReturnType<typeof createWriter<BackerPayment>>;
  } | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    let alive = true;
    (boot ?? loadAll()).then((d) => {
      boot = null;
      if (!alive) return;
      if (d.hands.problems + d.sessions.problems + d.players.problems) console.warn('[store] unreadable items skipped', d.hands.problems, d.sessions.problems, d.players.problems);
      if (__DEV__) console.log(`[store] loaded ${d.hands.items.length} hands in ${d.ms} ms`);
      const w = {
        hands: createWriter(kv, SPECS.hands, d.hands.persisted, storageFailed),
        sessions: createWriter(kv, SPECS.sessions, d.sessions.persisted, storageFailed),
        players: createWriter(kv, SPECS.players, d.players.persisted, storageFailed),
        backers: createWriter(kv, SPECS.backers, d.backers.persisted, storageFailed),
        packages: createWriter(kv, SPECS.packages, d.packages.persisted, storageFailed),
        payments: createWriter(kv, SPECS.payments, d.payments.persisted, storageFailed),
      };
      writers.current = w;
      // Anything not yet on disk in the current layout (a rebuilt index, a
      // migration that couldn't finish) gets written on the first flush.
      if (d.hands.persisted !== d.hands.items) w.hands.schedule(d.hands.items);
      if (d.sessions.persisted !== d.sessions.items) w.sessions.schedule(d.sessions.items);
      if (d.players.persisted !== d.players.items) w.players.schedule(d.players.items);
      if (d.backers.persisted !== d.backers.items) w.backers.schedule(d.backers.items);
      if (d.packages.persisted !== d.packages.items) w.packages.schedule(d.packages.items);
      if (d.payments.persisted !== d.payments.items) w.payments.schedule(d.payments.items);
      setHands(d.hands.items);
      setSessions(d.sessions.items);
      setPlayers(d.players.items);
      setBackers(d.backers.items);
      setPackages(d.packages.items);
      setPayments(d.payments.items);
      setSettingsState({ ...DEFAULT_SETTINGS, ...d.settings });
      draftRef.current = d.draft;
      setDraftKey(draftKeyOf(d.draft));
      loaded.current = true;
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Writes are coalesced (one per burst of edits); going to the background
  // writes immediately so a killed app doesn't lose the last hand.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active' || !writers.current) return;
      const w = writers.current;
      w.hands.flush();
      w.sessions.flush();
      w.players.flush();
      w.backers.flush();
      w.packages.flush();
      w.payments.flush();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (loaded.current) writers.current?.hands.schedule(hands);
  }, [hands]);
  useEffect(() => {
    if (loaded.current) writers.current?.sessions.schedule(rawSessions);
  }, [rawSessions]);
  useEffect(() => {
    if (loaded.current) writers.current?.players.schedule(players);
  }, [players]);
  useEffect(() => {
    if (loaded.current) writers.current?.backers.schedule(backers);
  }, [backers]);
  useEffect(() => {
    if (loaded.current) writers.current?.packages.schedule(packages);
  }, [packages]);
  useEffect(() => {
    if (loaded.current) writers.current?.payments.schedule(payments);
  }, [payments]);
  useEffect(() => {
    if (loaded.current) persist(KEYS.settings, settings);
  }, [settings]);

  const saveHand = useCallback((h: Hand) => setHands((l) => upsert(l, { ...h, updatedAt: Date.now() })), []);
  const deleteHand = useCallback((id: string) => setHands((l) => l.filter((x) => x.id !== id)), []);
  const saveSession = useCallback((s: Session) => setSessions((l) => upsert(l, { ...bare(s), updatedAt: Date.now() })), []);
  const deleteSession = useCallback((id: string) => setSessions((l) => l.filter((x) => x.id !== id)), []);
  const savePlayer = useCallback(
    (p: PlayerNote) => setPlayers((l) => upsert(l, { ...p, updatedAt: Date.now() })),
    [],
  );
  const deletePlayer = useCallback((id: string) => setPlayers((l) => l.filter((x) => x.id !== id)), []);
  const saveBacker = useCallback((b: Backer) => setBackers((l) => upsert(l, { ...b, updatedAt: Date.now() })), []);
  const deleteBacker = useCallback((id: string) => {
    setBackers((l) => l.filter((x) => x.id !== id));
    setPackages((l) => l.filter((x) => x.backerId !== id));
    setPayments((l) => l.filter((x) => x.backerId !== id));
    const now = Date.now();
    setSessions((l) =>
      l.map((s) =>
        s.stakes?.some((x) => x.backerId === id)
          ? { ...s, stakes: s.stakes.map((x) => (x.backerId === id ? { share: x.share, markup: x.markup } : x)), updatedAt: now }
          : s,
      ),
    );
  }, []);
  const savePackage = useCallback((p: StakePackage) => setPackages((l) => upsert(l, { ...p, updatedAt: Date.now() })), []);
  const deletePackage = useCallback((id: string) => {
    setPackages((l) => l.filter((x) => x.id !== id));
    const now = Date.now();
    // Its sessions keep the stake, as a plain sale to the same backer.
    setSessions((l) =>
      l.map((s) =>
        s.stakes?.some((x) => x.packageId === id)
          ? { ...s, stakes: s.stakes.map((x) => (x.packageId === id ? { ...x, packageId: undefined } : x)), updatedAt: now }
          : s,
      ),
    );
  }, []);
  const savePayment = useCallback((p: BackerPayment) => setPayments((l) => upsert(l, { ...p, updatedAt: Date.now() })), []);
  const deletePayment = useCallback((id: string) => setPayments((l) => l.filter((x) => x.id !== id)), []);
  const setSettings = useCallback((patch: Partial<Settings>) => setSettingsState((s) => ({ ...s, ...patch })), []);
  const setDraft = useCallback((h: Hand | null) => {
    draftRef.current = h;
    setDraftKey(draftKeyOf(h));
    if (h) persist(KEYS.draft, h);
    else AsyncStorage.removeItem(KEYS.draft).catch(() => {});
  }, []);

  const importData = useCallback(
    (b: BackupData) => {
      const h = mergeById(hands, b.hands);
      const s = mergeById(rawSessions, b.sessions.map(bare));
      const p = mergeById(players, b.players);
      const bk = mergeById(backers, b.backers ?? []);
      setHands(h.list);
      setSessions(s.list);
      setPlayers(p.list);
      setBackers(bk.list);
      setPackages(mergeById(packages, b.packages ?? []).list);
      setPayments(mergeById(payments, b.payments ?? []).list);
      setSettingsState((cur) => ({ ...cur, nickname: cur.nickname || b.settings?.nickname || '' }));
      return { hands: h.added, sessions: s.added, players: p.added, backers: bk.added };
    },
    [hands, rawSessions, players, backers, packages, payments],
  );

  const activeSession = useMemo(
    () => sessions.filter((s) => !s.endedAt).sort((a, b) => b.startedAt - a.startedAt)[0] ?? null,
    [sessions],
  );

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      hands,
      sessions,
      players,
      backers,
      packages,
      payments,
      settings,
      activeSession,
      saveHand,
      deleteHand,
      saveSession,
      deleteSession,
      savePlayer,
      deletePlayer,
      saveBacker,
      deleteBacker,
      savePackage,
      deletePackage,
      savePayment,
      deletePayment,
      setSettings,
      get draft() {
        return draftRef.current;
      },
      setDraft,
      importData,
    }),
    // draftKey: re-render consumers when a resumable draft appears or goes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, hands, sessions, players, backers, packages, payments, settings, activeSession, saveHand, deleteHand, saveSession, deleteSession, savePlayer, deletePlayer, saveBacker, deleteBacker, savePackage, deletePackage, savePayment, deletePayment, setSettings, draftKey, setDraft, importData],
  );

  // Nothing renders before the data is in, so no screen flashes its empty
  // state ("Regista a tua primeira mão") at a player with 2,000 hands.
  return <Ctx.Provider value={value}>{ready ? children : null}</Ctx.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}
