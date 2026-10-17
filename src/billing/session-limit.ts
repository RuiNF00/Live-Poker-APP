// Hands a free player couldn't save during a live session because of the daily
// limit. The session summary turns this into its Pro card ("2 mãos desta sessão
// ficaram por guardar"): the player's own hands are the strongest argument.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'rl.session.blocked.v1';
/** Only the latest sessions are kept. */
const KEEP = 20;

type Blocked = Record<string, string[]>;

/** Adds a hand to a session's list, newest sessions last (pure, tested). */
export function addBlocked(all: Blocked, sessionId: string, handId: string): Blocked {
  const ids = all[sessionId] ?? [];
  if (ids.includes(handId)) return all;
  const { [sessionId]: _, ...rest } = all;
  const keys = Object.keys(rest).slice(-(KEEP - 1));
  return { ...Object.fromEntries(keys.map((k) => [k, rest[k]])), [sessionId]: [...ids, handId] };
}

async function load(): Promise<Blocked> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v ? (JSON.parse(v) as Blocked) : {};
  } catch {
    return {};
  }
}

export async function noteBlocked(sessionId: string, handId: string): Promise<void> {
  const next = addBlocked(await load(), sessionId, handId);
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
}

export async function blockedIn(sessionId: string): Promise<number> {
  return (await load())[sessionId]?.length ?? 0;
}

export type SessionEndCard = { kind: 'blocked'; n: number } | { kind: 'rate' };

/**
 * The session summary's Pro card (pure, tested). Never after a losing session:
 * there the home screen offers "Rever as mãos de hoje" instead.
 */
export function sessionEndCard(o: { isPro: boolean; profit: number; blocked: number; hours: number; game: 'mtt' | 'cash' }): SessionEndCard | null {
  if (o.isPro || o.profit < 0) return null;
  if (o.blocked > 0) return { kind: 'blocked', n: o.blocked };
  return o.game === 'cash' && o.hours >= 1 ? { kind: 'rate' } : null;
}
