// Local-first store: everything lives on the device (AsyncStorage) so the app
// works with no account and no signal in a card room. Sharing is the only
// thing that touches the network.

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { Hand } from '@/poker/types';

import { mergeById, type BackupData } from './backup';
import { DEFAULT_SETTINGS, type PlayerNote, type Session, type Settings } from './types';

const KEYS = {
  hands: 'rl.hands.v1',
  sessions: 'rl.sessions.v1',
  players: 'rl.players.v1',
  settings: 'rl.settings.v1',
  draft: 'rl.draft.v1',
};

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

function persist(key: string, value: unknown) {
  AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
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
  const [draft, setDraftState] = useState<Hand | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    (async () => {
      const [h, s, p, st, d] = await Promise.all([
        load<Hand[]>(KEYS.hands, []),
        load<Session[]>(KEYS.sessions, []),
        load<PlayerNote[]>(KEYS.players, []),
        load<Settings>(KEYS.settings, DEFAULT_SETTINGS),
        load<Hand | null>(KEYS.draft, null),
      ]);
      setHands(h);
      setSessions(s);
      setPlayers(p);
      setSettingsState({ ...DEFAULT_SETTINGS, ...st });
      setDraftState(d);
      loaded.current = true;
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded.current) persist(KEYS.hands, hands);
  }, [hands]);
  useEffect(() => {
    if (loaded.current) persist(KEYS.sessions, sessions);
  }, [sessions]);
  useEffect(() => {
    if (loaded.current) persist(KEYS.players, players);
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
  const setDraft = useCallback((h: Hand | null) => {
    setDraftState(h);
    if (h) persist(KEYS.draft, h);
    else AsyncStorage.removeItem(KEYS.draft).catch(() => {});
  }, []);

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

  const value = useMemo(
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
      draft,
      setDraft,
      importData,
    }),
    [ready, hands, sessions, players, settings, activeSession, saveHand, deleteHand, saveSession, deleteSession, savePlayer, deletePlayer, setSettings, draft, setDraft, importData],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}
