// The notification policy, live: mirrors Settings and the live session so
// schedulers outside React (coach sync, swaps, recap) can ask before they post.
// What a live session holds goes out when it ends or pauses, one per kind.

import { useEffect } from 'react';

import { isPaused } from '@/store/session-math';
import { useStore } from '@/store/store';
import type { Settings } from '@/store/types';

import { holdNow, kindOn, outOfQuiet, type NotifyKind } from './notify-policy';

let settings: Partial<Settings> = {};
let live: { paused: boolean } | null = null;
const held = new Map<NotifyKind, () => void>();

function flush() {
  if (live && !live.paused) return;
  const run = [...held.values()];
  held.clear();
  for (const f of run) f();
}

/**
 * Post now, hold for the end of the session, or drop (kind switched off).
 * The latest held notice of a kind replaces the earlier one.
 */
export function notifyOrHold(kind: NotifyKind, post: () => void): 'sent' | 'held' | 'off' {
  if (!kindOn(settings, kind)) return 'off';
  if (holdNow(kind, live, settings)) {
    held.set(kind, post);
    return 'held';
  }
  post();
  return 'sent';
}

/** Amounts may show in a notification (they reach the lock screen): off by default. */
export const notifyAmountsOn = () => !!settings.notifyAmounts && !settings.hideAmounts;

/** Is this kind on? For schedulers that plan ahead (recap, staking). */
export const notifyKindOn = (kind: NotifyKind) => kindOn(settings, kind);

/** The time to schedule at, out of the quiet hours. */
export const notifyAt = (kind: NotifyKind, at: number) => outOfQuiet(at, kind);

/** Mounted once in the root layout. */
export function NotifyPolicySync() {
  const { settings: s, activeSession } = useStore();
  const paused = activeSession ? isPaused(activeSession) : false;
  useEffect(() => {
    settings = s;
    live = activeSession ? { paused } : null;
    flush();
  }, [s, activeSession, paused]);
  return null;
}
