// Local-first store: everything lives on the device (AsyncStorage) so the app
// works with no account and no signal in a card room. Sharing is the only
// thing that touches the network.

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { t } from '@/i18n';
import type { Statement } from '@/lib/backing-link';
import { eraseLocal, eraseRemote } from '@/lib/erase-all';
import { useRates } from '@/lib/fx';
import { queueLiveDelete } from '@/lib/live-cleanup';
import { withLevelClock } from '@/lib/lock-screen/live-state';
import { notice } from '@/lib/notice';
import { forgetHandShare } from '@/lib/share-queue';

import { setMoneyMasked } from '@/poker/format';
import type { Hand } from '@/poker/types';

import { mergeById, restoredSettings, type BackupData } from './backup';
import { bankrollOf, bankrollsBack, dropUnusedAuto, ensureBankrolls, sortBankrolls } from './bankroll-math';
import { clearPlans } from './festival-plan';
import { clearOwnFestivals } from './my-festivals';
import { KEYS, SPECS, loadAll as readAll } from './boot';
import { createWriter, type KV } from './persist';
import { withCuts } from './staking';
import { mergeSwaps, withSwaps, type Swap } from './swaps';
import { currentSwaps, importSwaps, useSwaps } from './swaps-store';
import type { SwapGroup } from './swap-groups';
import { currentGroups, importGroups, useGroups } from './swap-groups-store';
import { DEFAULT_SETTINGS, type BackedPlayer, type Backer, type BackerPayment, type Bankroll, type PlayerNote, type Session, type Settings, type StakePackage, type Transfer, type Trip } from './types';

export function uid(prefix = ''): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

interface StoreValue {
  ready: boolean;
  hands: Hand[];
  sessions: Session[];
  players: PlayerNote[];
  /** Oldest first. Never empty once ready. */
  bankrolls: Bankroll[];
  transfers: Transfer[];
  backers: Backer[];
  packages: StakePackage[];
  payments: BackerPayment[];
  /** Newest first. */
  trips: Trip[];
  /** Players you back, each with the last statement they sent you. */
  backing: BackedPlayer[];
  /** Values set aside at launch because they couldn't be read: [key, raw]. In the backup, and in Settings › Enviar ao suporte. */
  quarantine: [string, string][];
  settings: Settings;
  activeSession: Session | null;
  /** Where a new session goes: the last one picked, else the first in the player's currency. */
  defaultBankroll: Bankroll;
  saveHand: (h: Hand) => void;
  deleteHand: (id: string) => void;
  saveSession: (s: Session) => void;
  deleteSession: (id: string) => void;
  savePlayer: (p: PlayerNote) => void;
  deletePlayer: (id: string) => void;
  saveBankroll: (b: Bankroll) => void;
  /**
   * Deletes a bankroll; its sessions and transfers move to another bankroll
   * in the same currency. False (nothing changed) when there is none to take
   * them, or it is the last bankroll.
   */
  deleteBankroll: (id: string) => boolean;
  saveTransfer: (x: Transfer) => void;
  deleteTransfer: (id: string) => void;
  saveBacker: (b: Backer) => void;
  /** Removes the backer, their packages and payments; their stakes in sessions stay, unnamed. */
  deleteBacker: (id: string) => void;
  savePackage: (p: StakePackage) => void;
  deletePackage: (id: string) => void;
  savePayment: (p: BackerPayment) => void;
  deletePayment: (id: string) => void;
  saveTrip: (x: Trip) => void;
  deleteTrip: (id: string) => void;
  /** Saves a statement a player sent you; an older one never replaces a newer one. */
  saveBacked: (st: Statement) => 'new' | 'updated' | 'older';
  deleteBacked: (id: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  draft: Hand | null;
  setDraft: (h: Hand | null) => void;
  /** Merge a backup in: newer copy of each item wins, nothing local is deleted. */
  /** Swaps live in their own store (swaps-store.ts); read here so every backup includes them. */
  readonly swaps: Swap[];
  readonly swapGroups: SwapGroup[];
  importData: (b: BackupData) => { hands: number; sessions: number; players: number; backers: number; bankrolls: number; transfers: number; trips: number; packages: number; payments: number; backing: number; swaps: number };
  /** Settings › Delete all my data: public copies are queued for deletion, then the phone is emptied. */
  eraseAll: () => Promise<void>;
}

const Ctx = createContext<StoreValue | null>(null);

let warned = false;
/** Tell the player once per launch: a save that silently fails is lost work. */
function storageFailed(e: unknown) {
  console.warn('[store] write failed', e);
  if (warned) return;
  warned = true;
  notice(
    t('Não foi possível guardar'),
    t('O telemóvel recusou gravar os dados (pouco espaço livre?). Tenta libertar espaço; a app volta a tentar sozinha.'),
  );
}

function persist(key: string, value: unknown) {
  AsyncStorage.setItem(key, JSON.stringify(value)).catch(storageFailed);
}

const kv = AsyncStorage as unknown as KV;

const loadAll = () => readAll(kv);

/** Damaged values were set aside at launch: say so once, so nothing vanishes silently. */
function quarantined(n: number) {
  console.warn('[store] values moved to quarantine', n);
  notice(
    t('Alguns dados estavam danificados'),
    (n === 1 ? t('1 registo não pôde ser lido. Guardámos uma cópia à parte neste telemóvel e o resto da app funciona normalmente. Se faltar alguma coisa, usa «Recuperar» na cópia na nuvem, em Definições.') : t('{n} registos não puderam ser lidos. Guardámos uma cópia à parte neste telemóvel e o resto da app funciona normalmente. Se faltar alguma coisa, usa «Recuperar» na cópia na nuvem, em Definições.', { n: n })),
  );
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
  if (s.makeupCut === undefined && s.swapNet === undefined) return s;
  const { makeupCut: _, swapNet: __, ...rest } = s;
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
  const [bankrolls, setBankrolls] = useState<Bankroll[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [backers, setBackers] = useState<Backer[]>([]);
  const [packages, setPackages] = useState<StakePackage[]>([]);
  const [payments, setPayments] = useState<BackerPayment[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [backing, setBacking] = useState<BackedPlayer[]>([]);
  const [quarantine, setQuarantine] = useState<[string, string][]>([]);
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  // What screens see: each session with its makeup package cut and what swaps add or take
  // (derived, never stored; swaps can be turned off).
  const { swaps } = useSwaps();
  const { groups } = useGroups();
  const includeSwaps = settings.includeSwaps !== false;
  // Rates for makeup packages with sessions in more than one currency (cut worked out in the package's).
  const fxSince = useMemo(() => {
    const other = packages.length ? rawSessions.filter((s) => s.stakes?.some((x) => x.packageId) && s.currency && s.currency !== settings.currency) : [];
    return other.length ? Math.min(...other.map((s) => s.startedAt)) : null;
  }, [rawSessions, packages.length, settings.currency]);
  const rates = useRates(fxSince);
  const sessions = useMemo(
    () => withSwaps(withCuts(rawSessions, packages, { table: rates, manual: settings.fxManual }), includeSwaps ? swaps : [], includeSwaps ? groups : []),
    [rawSessions, packages, swaps, groups, includeSwaps, rates, settings.fxManual],
  );
  // Privacy mode applies to every amount on screen, set before anything renders with it.
  setMoneyMasked(!!settings.hideAmounts);
  // The draft changes on every tap of hand entry. Keeping it in a ref (and
  // re-rendering only when 'is there a draft worth resuming' flips) stops
  // every screen behind the entry modal from re-rendering on each tap.
  const draftRef = useRef<Hand | null>(null);
  const [draftKey, setDraftKey] = useState(0);
  // Hand entry calls this on every tap; write the draft at most every 400 ms
  // (and at once when the app leaves the screen) instead of on each tap.
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushDraft = useCallback(() => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = null;
    const h = draftRef.current;
    if (h) persist(KEYS.draft, h);
    else AsyncStorage.removeItem(KEYS.draft).catch(() => {});
  }, []);
  const writers = useRef<{
    hands: ReturnType<typeof createWriter<Hand>>;
    sessions: ReturnType<typeof createWriter<Session>>;
    players: ReturnType<typeof createWriter<PlayerNote>>;
    bankrolls: ReturnType<typeof createWriter<Bankroll>>;
    transfers: ReturnType<typeof createWriter<Transfer>>;
    backers: ReturnType<typeof createWriter<Backer>>;
    packages: ReturnType<typeof createWriter<StakePackage>>;
    payments: ReturnType<typeof createWriter<BackerPayment>>;
    trips: ReturnType<typeof createWriter<Trip>>;
    backing: ReturnType<typeof createWriter<BackedPlayer>>;
  } | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    let alive = true;
    (boot ?? loadAll()).then((d) => {
      boot = null;
      if (!alive) return;
      if (d.quarantined) quarantined(d.quarantined);
      else if (d.recovered) notice(t('Dados recuperados'), (d.recovered === 1 ? t('1 registo que estava guardado à parte voltou a abrir e está de volta na app.') : t('{n} registos que estavam guardados à parte voltaram a abrir e estão de volta na app.', { n: d.recovered })));
      if (d.unreadable) console.warn('[store] unreadable values left in place', d.unreadable);
      if (__DEV__) console.log(`[store] loaded ${d.hands.items.length} hands in ${d.ms} ms`);
      const w = {
        hands: createWriter(kv, SPECS.hands, d.hands.persisted, storageFailed),
        sessions: createWriter(kv, SPECS.sessions, d.sessions.persisted, storageFailed),
        players: createWriter(kv, SPECS.players, d.players.persisted, storageFailed),
        bankrolls: createWriter(kv, SPECS.bankrolls, d.bankrolls.persisted, storageFailed),
        transfers: createWriter(kv, SPECS.transfers, d.transfers.persisted, storageFailed),
        backers: createWriter(kv, SPECS.backers, d.backers.persisted, storageFailed),
        packages: createWriter(kv, SPECS.packages, d.packages.persisted, storageFailed),
        payments: createWriter(kv, SPECS.payments, d.payments.persisted, storageFailed),
        trips: createWriter(kv, SPECS.trips, d.trips.persisted, storageFailed),
        backing: createWriter(kv, SPECS.backing, d.backing.persisted, storageFailed),
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
      if (d.backing.persisted !== d.backing.items) w.backing.schedule(d.backing.items);
      if (d.transfers.persisted !== d.transfers.items) w.transfers.schedule(d.transfers.items);
      if (d.trips.persisted !== d.trips.items) w.trips.schedule(d.trips.items);
      const st = d.settings;
      // Older data has no bankrolls: one per currency is made on first launch.
      const br = ensureBankrolls(d.bankrolls.items, d.sessions.items, st.currency);
      if (d.bankrolls.persisted !== br) w.bankrolls.schedule(br);
      setHands(d.hands.items);
      setSessions(d.sessions.items);
      setPlayers(d.players.items);
      setBankrolls(br);
      setTransfers(d.transfers.items);
      setBackers(d.backers.items);
      setPackages(d.packages.items);
      setPayments(d.payments.items);
      setTrips(d.trips.items);
      setBacking(d.backing.items);
      setQuarantine(d.quarantine);
      setSettingsState(st);
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
      if (st === 'active') return;
      if (draftTimer.current) flushDraft(); // only an unsaved change
      if (!writers.current) return;
      const w = writers.current;
      w.hands.flush();
      w.sessions.flush();
      w.players.flush();
      w.bankrolls.flush();
      w.transfers.flush();
      w.backers.flush();
      w.packages.flush();
      w.payments.flush();
      w.trips.flush();
      w.backing.flush();
    });
    return () => sub.remove();
  }, [flushDraft]);

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
    if (loaded.current) writers.current?.bankrolls.schedule(bankrolls);
  }, [bankrolls]);
  useEffect(() => {
    if (loaded.current) writers.current?.transfers.schedule(transfers);
  }, [transfers]);
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
    if (loaded.current) writers.current?.trips.schedule(trips);
  }, [trips]);
  useEffect(() => {
    if (loaded.current) writers.current?.backing.schedule(backing);
  }, [backing]);
  useEffect(() => {
    if (loaded.current) persist(KEYS.settings, settings);
  }, [settings]);
  // A session in a new currency (or an import) gets a bankroll to count towards.
  useEffect(() => {
    if (!loaded.current) return;
    setBankrolls((cur) => ensureBankrolls(cur, sessions, settings.currency));
  }, [sessions, settings.currency]);

  const saveHand = useCallback((h: Hand) => setHands((l) => upsert(l, { ...h, updatedAt: Date.now() })), []);
  // A deleted hand or session takes its public page with it (queued, so it also works
  // without signal). The queue is keyed, so a second run of the updater changes nothing.
  const deleteHand = useCallback(
    (id: string) =>
      setHands((l) => {
        const h = l.find((x) => x.id === id);
        if (h) forgetHandShare(h).catch(() => {});
        return l.filter((x) => x.id !== id);
      }),
    [],
  );
  const saveSession = useCallback(
    (s: Session) =>
      setSessions((l) => {
        const now = Date.now();
        return upsert(l, { ...withLevelClock(l.find((x) => x.id === s.id), bare(s), now), updatedAt: now });
      }),
    [],
  );
  const deleteSession = useCallback(
    (id: string) =>
      setSessions((l) => {
        const s = l.find((x) => x.id === id);
        if (s?.live) queueLiveDelete(s.live);
        return l.filter((x) => x.id !== id);
      }),
    [],
  );
  const savePlayer = useCallback(
    (p: PlayerNote) => setPlayers((l) => upsert(l, { ...p, updatedAt: Date.now() })),
    [],
  );
  const deletePlayer = useCallback((id: string) => setPlayers((l) => l.filter((x) => x.id !== id)), []);
  const saveBankroll = useCallback((b: Bankroll) => setBankrolls((l) => upsert(l, { ...b, updatedAt: Date.now() })), []);
  const saveTransfer = useCallback((x: Transfer) => setTransfers((l) => upsert(l, { ...x, updatedAt: Date.now() })), []);
  const deleteTransfer = useCallback((id: string) => setTransfers((l) => l.filter((x) => x.id !== id)), []);
  const deleteBankroll = useCallback(
    (id: string) => {
      const gone = bankrolls.find((b) => b.id === id);
      if (!gone || bankrolls.length < 2) return false;
      const to = sortBankrolls(bankrolls).find((b) => b.id !== id && b.currency === gone.currency);
      const owned = sessions.some((s) => bankrollOf(s, bankrolls)?.id === id) || transfers.some((x) => x.bankrollId === id);
      if (!to && owned) return false;
      const now = Date.now();
      if (to) {
        setSessions((l) => l.map((s) => (s.bankrollId === id ? { ...s, bankrollId: to.id, updatedAt: now } : s)));
        setTransfers((l) => l.map((x) => (x.bankrollId === id ? { ...x, bankrollId: to.id, updatedAt: now } : x)));
      }
      setBankrolls((l) => l.filter((b) => b.id !== id));
      setSettingsState((st) => (st.bankrollId === id ? { ...st, bankrollId: to?.id } : st));
      return true;
    },
    [bankrolls, sessions, transfers],
  );
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
  const saveTrip = useCallback((x: Trip) => setTrips((l) => upsert(l, { ...x, updatedAt: Date.now() })), []);
  const deleteTrip = useCallback((id: string) => setTrips((l) => l.filter((x) => x.id !== id)), []);
  const backingRef = useRef(backing);
  useEffect(() => {
    backingRef.current = backing;
  }, [backing]);
  const saveBacked = useCallback((st: Statement) => {
    const cur = backingRef.current.find((x) => x.id === st.id);
    if (cur && cur.statement.at > st.at) return 'older' as const;
    const now = Date.now();
    setBacking((l) => upsert(l, { id: st.id, statement: st, createdAt: cur?.createdAt ?? now, updatedAt: now }));
    return cur ? ('updated' as const) : ('new' as const);
  }, []);
  const deleteBacked = useCallback((id: string) => setBacking((l) => l.filter((x) => x.id !== id)), []);
  const setSettings = useCallback((patch: Partial<Settings>) => setSettingsState((s) => ({ ...s, ...patch })), []);
  const setDraft = useCallback(
    (h: Hand | null) => {
      draftRef.current = h;
      setDraftKey(draftKeyOf(h));
      if (!h) flushDraft();
      else if (!draftTimer.current) draftTimer.current = setTimeout(flushDraft, 400);
    },
    [flushDraft],
  );

  const importData = useCallback(
    (b: BackupData) => {
      const h = mergeById(hands, b.hands);
      const s = mergeById(rawSessions, b.sessions.map(bare));
      const p = mergeById(players, b.players);
      const br = mergeById(bankrolls, b.bankrolls ?? []);
      const tx = mergeById(transfers, b.transfers ?? []);
      const bk = mergeById(backers, b.backers ?? []);
      const tr = mergeById(trips, b.trips ?? []);
      setHands(h.list);
      setSessions(s.list);
      setPlayers(p.list);
      setBankrolls(dropUnusedAuto(br.list, b.bankrolls ?? [], { bankrolls, sessions: rawSessions, transfers }));
      setTransfers(tx.list);
      setBackers(bk.list);
      const pk = mergeById(packages, b.packages ?? []);
      const pay = mergeById(payments, b.payments ?? []);
      const bc = mergeById(backing, b.backing ?? []);
      setPackages(pk.list);
      setPayments(pay.list);
      setTrips(tr.list);
      setBacking(bc.list);
      const fresh = !hands.length && !rawSessions.length;
      setSettingsState((cur) => restoredSettings(cur, b.settings, fresh));
      // Counted against what's loaded now; importSwaps merges the same way.
      const sw = mergeSwaps(currentSwaps(), b.swaps ?? []).added;
      importSwaps(b.swaps ?? []).catch(() => {});
      importGroups(b.swapGroups ?? []).catch(() => {});
      // Values another phone had set aside: kept here too; each launch tries them again with this version's checks.
      const q = (b.quarantine ?? []).filter(([k]) => !quarantine.some(([have]) => have === k));
      if (q.length) {
        AsyncStorage.multiSet(q).catch(storageFailed);
        setQuarantine((cur) => [...cur, ...q]);
      }
      return { hands: h.added, sessions: s.added, players: p.added, backers: bk.added, bankrolls: bankrollsBack(b.bankrolls ?? [], { bankrolls, sessions: rawSessions, transfers }), transfers: tx.added, trips: tr.added, packages: pk.added, payments: pay.added, backing: bc.added, swaps: sw };
    },
    [hands, rawSessions, players, bankrolls, transfers, backers, packages, payments, trips, backing, quarantine],
  );

  const eraseAll = useCallback(async () => {
    await eraseRemote({ hands, sessions: rawSessions });
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = null;
    draftRef.current = null;
    // Empty lists written (and awaited) before the rest of the keys go, so no late write brings anything back.
    const w = writers.current;
    if (w) {
      w.hands.schedule([]);
      w.sessions.schedule([]);
      w.players.schedule([]);
      w.bankrolls.schedule([]);
      w.transfers.schedule([]);
      w.backers.schedule([]);
      w.packages.schedule([]);
      w.payments.schedule([]);
      w.trips.schedule([]);
      w.backing.schedule([]);
      await Promise.all(Object.values(w).map((x) => x.flush()));
    }
    await eraseLocal();
    clearPlans();
    clearOwnFestivals();
    setHands([]);
    setSessions([]);
    setPlayers([]);
    setBankrolls(ensureBankrolls([], [], DEFAULT_SETTINGS.currency));
    setTransfers([]);
    setBackers([]);
    setPackages([]);
    setPayments([]);
    setTrips([]);
    setBacking([]);
    setQuarantine([]);
    setSettingsState(DEFAULT_SETTINGS);
    setDraftKey(draftKeyOf(null));
  }, [hands, rawSessions]);

  const activeSession = useMemo(
    () => sessions.filter((s) => !s.endedAt).sort((a, b) => b.startedAt - a.startedAt)[0] ?? null,
    [sessions],
  );

  const sortedTrips = useMemo(() => [...trips].sort((a, b) => b.from - a.from), [trips]);
  const sortedBankrolls = useMemo(() => sortBankrolls(bankrolls), [bankrolls]);
  const defaultBankroll = useMemo(
    () =>
      sortedBankrolls.find((b) => b.id === settings.bankrollId) ??
      sortedBankrolls.find((b) => b.currency === settings.currency) ??
      sortedBankrolls[0] ?? { id: '', name: '', currency: settings.currency, createdAt: 0 },
    [sortedBankrolls, settings.bankrollId, settings.currency],
  );

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      hands,
      sessions,
      players,
      bankrolls: sortedBankrolls,
      transfers,
      backers,
      packages,
      payments,
      trips: sortedTrips,
      backing,
      quarantine,
      settings,
      activeSession,
      defaultBankroll,
      saveHand,
      deleteHand,
      saveSession,
      deleteSession,
      savePlayer,
      deletePlayer,
      saveBankroll,
      deleteBankroll,
      saveTransfer,
      deleteTransfer,
      saveBacker,
      deleteBacker,
      savePackage,
      deletePackage,
      savePayment,
      deletePayment,
      saveTrip,
      deleteTrip,
      saveBacked,
      deleteBacked,
      setSettings,
      get draft() {
        return draftRef.current;
      },
      setDraft,
      eraseAll,
      importData,
      get swaps() {
        return currentSwaps();
      },
      get swapGroups() {
        return currentGroups();
      },
    }),
    // draftKey: re-render consumers when a resumable draft appears or goes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, hands, sessions, players, sortedBankrolls, transfers, backers, packages, payments, sortedTrips, backing, quarantine, settings, activeSession, defaultBankroll, saveHand, deleteHand, saveSession, deleteSession, savePlayer, deletePlayer, saveBankroll, deleteBankroll, saveTransfer, deleteTransfer, saveBacker, deleteBacker, savePackage, deletePackage, savePayment, deletePayment, saveTrip, deleteTrip, saveBacked, deleteBacked, setSettings, draftKey, setDraft, eraseAll, importData],
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
