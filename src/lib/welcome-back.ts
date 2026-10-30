// «Olá outra vez» on the Resumo after a long pause: no notification brings anyone back after 30
// days (the 4-day reminder stops after two tries), so the app says it when they open it. It stays
// until a session of the last 30 days is logged or the card is closed. About the sessions played
// meanwhile, never about going to play.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const DAY = 86_400_000;
export const WELCOME_BACK_AFTER = 30 * DAY;
const KEY = 'rl.welcome-back.v1';

/** The last thing logged: a session started or a hand saved. 0 when nothing was. */
export function lastActivity(sessions: readonly { startedAt: number }[], hands: readonly { createdAt: number }[]): number {
  return Math.max(0, ...sessions.map((s) => s.startedAt), ...hands.map((h) => h.createdAt));
}

/** Shown once per pause: `dismissed` is the last activity of the pause already greeted. */
export function welcomeBackDue(last: number, now: number, dismissed: number | null): boolean {
  return last > 0 && now - last >= WELCOME_BACK_AFTER && dismissed !== last;
}

export function useWelcomeBack(last: number, now: number): { show: boolean; dismiss: () => void } {
  const [dismissed, setDismissed] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => setDismissed(v ? Number(v) : null))
      .catch(() => setDismissed(null));
  }, []);
  return {
    show: dismissed !== undefined && welcomeBackDue(last, now, dismissed),
    dismiss: () => {
      setDismissed(last);
      AsyncStorage.setItem(KEY, String(last)).catch(() => {});
    },
  };
}
