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
import { DEFAULT_SETTINGS, type PlayerNote, type Session, type Settings } from './types';

const KEYS = {
  settings: 'rl.settings.v1',
  draft: 'rl.draft.v1',
};

const SPECS = {
  hands: { index: 'rl.hands.v2', prefix: 'rl.hand.v2.', legacy: 'rl.hands.v1' },
  sessions: { index: 'rl.sessions.v2', prefix: 'rl.session.v2.', legacy: 'rl.sessions.v1' },
  players: { index: 'rl.players.v2', prefix: 'rl.player.v2.', legacy: 'rl.players.v1' },
} satisfies Record<string, CollectionSpec>;

export function uid(prefix = ''): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

interface StoreValue {
  ready: boolean;
  hands: Hand[];
  sessions: Session[];
  players: PlayerNote[];
  settings: Settings;
  activeSession: Session | null;
  saveHand: (h: Hand) => void;
  deleteHand: (id: string) => void;
  saveSession: (s: Session) => void;
  deleteSession: (id: string) => void;
  savePlayer: (p: PlayerNote) => void;
  deletePlayer: (id: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  draft: Hand | null;
  setDraft: (h: Hand | null) => void;
  /** Merge a backup in: newer copy of each item wins, nothing local is deleted. */
  importData: (b: BackupData) => { hands: number; sessions: number; players: number };
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
  ]).then(([hands, sessions, players, settings, draft]) => ({ hands, sessions, players, settings, draft, ms: Date.now() - t0 }));
}

// Start reading as soon as the bundle runs, in parallel with fonts and the
// first render, instead of after them.
let boot: ReturnType<typeof loadAll> | null = loadAll();

/** 0 none, 1 empty draft, 2 a draft with something in it (what the hands list shows). */
function draftKeyOf(h: Hand | null): number {
  if (!h) return 0;
  return h.actions.length || h.players[h.hero]?.cards?.length ? 2 : 1;
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
  const [sessions, setSessions] = useState<Session[]>([]);
  const [players, setPlayers] = useState<PlayerNote[]>([]);
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
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
      };
      writers.current = w;
      // Anything not yet on disk in the current layout (a rebuilt index, a
      // migration that couldn't finish) gets written on the first flush.
      if (d.hands.persisted !== d.hands.items) w.hands.schedule(d.hands.items);
      if (d.sessions.persisted !== d.sessions.items) w.sessions.schedule(d.sessions.items);
      if (d.players.persisted !== d.players.items) w.players.schedule(d.players.items);
      setHands(d.hands.items);
      setSessions(d.sessions.items);
      setPlayers(d.players.items);
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
      if (st === 'active') return;
      if (draftTimer.current) flushDraft(); // only an unsaved change
      if (!writers.current) return;
      const w = writers.current;
      w.hands.flush();
      w.sessions.flush();
      w.players.flush();
    });
    return () => sub.remove();
  }, [flushDraft]);

  useEffect(() => {
    if (loaded.current) writers.current?.hands.schedule(hands);
  }, [hands]);
  useEffect(() => {
    if (loaded.current) writers.current?.sessions.schedule(sessions);
  }, [sessions]);
  useEffect(() => {
    if (loaded.current) writers.current?.players.schedule(players);
  }, [players]);
  useEffect(() => {
    if (loaded.current) persist(KEYS.settings, settings);
  }, [settings]);

  const saveHand = useCallback((h: Hand) => setHands((l) => upsert(l, { ...h, updatedAt: Date.now() })), []);
  const deleteHand = useCallback((id: string) => setHands((l) => l.filter((x) => x.id !== id)), []);
  const saveSession = useCallback((s: Session) => setSessions((l) => upsert(l, { ...s, updatedAt: Date.now() })), []);
  const deleteSession = useCallback((id: string) => setSessions((l) => l.filter((x) => x.id !== id)), []);
  const savePlayer = useCallback(
    (p: PlayerNote) => setPlayers((l) => upsert(l, { ...p, updatedAt: Date.now() })),
    [],
  );
  const deletePlayer = useCallback((id: string) => setPlayers((l) => l.filter((x) => x.id !== id)), []);
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
      const s = mergeById(sessions, b.sessions);
      const p = mergeById(players, b.players);
      setHands(h.list);
      setSessions(s.list);
      setPlayers(p.list);
      setSettingsState((cur) => ({ ...cur, nickname: cur.nickname || b.settings?.nickname || '' }));
      return { hands: h.added, sessions: s.added, players: p.added };
    },
    [hands, sessions, players],
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
      settings,
      activeSession,
      saveHand,
      deleteHand,
      saveSession,
      deleteSession,
      savePlayer,
      deletePlayer,
      setSettings,
      get draft() {
        return draftRef.current;
      },
      setDraft,
      importData,
    }),
    // draftKey: re-render consumers when a resumable draft appears or goes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, hands, sessions, players, settings, activeSession, saveHand, deleteHand, saveSession, deleteSession, savePlayer, deletePlayer, setSettings, draftKey, setDraft, importData],
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
