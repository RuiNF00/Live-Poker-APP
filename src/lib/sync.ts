// Wires the outbox and the online state into the app: one queue on the phone,
// sent when the signal comes back, when the app returns to the foreground, or
// when a retry is due. Nothing here ever blocks the screen.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { BRAND } from '@/theme';

import { isOnline, observeFetch, onReconnect, probeWhileOffline, reportNetwork, subscribeOnline } from './online';
import { createOutbox, type Outcome, type Sender } from './outbox';

const API = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? BRAND.webUrl;

const senders: Record<string, Sender> = {};
// Analytics go out with the rest but are not "por enviar" for the player.
const outbox = createOutbox(AsyncStorage, senders, { quiet: ['event'] });

/** Each feature registers how to send its kind of job. */
export function registerSender(kind: string, send: Sender) {
  senders[kind] = send;
}

/** HTTP status → what to do with the job. */
export function outcomeOf(status: number): Outcome {
  if (status < 400) return 'done';
  if (status === 408 || status === 429 || status >= 500) return 'retry';
  return 'drop';
}

let timer: ReturnType<typeof setTimeout> | null = null;
async function drainSoon(force = false) {
  if (!isOnline() && !force) return;
  await outbox.drain(force);
  // Wake up again when the next retry is due.
  if (timer) clearTimeout(timer);
  timer = null;
  const due = await outbox.nextDue();
  if (due !== null) timer = setTimeout(() => drainSoon(), Math.max(1000, due - Date.now()));
}

/** Keep `payload` for sending; same kind+key replaces an older one. */
export function queue(kind: string, payload: unknown, key?: string) {
  outbox
    .enqueue(kind, payload, key)
    .then(() => drainSoon())
    .catch(() => {});
}

/** Forget a job that hasn't been sent yet (say, the thing it was about was deleted). */
export function unqueue(kind: string, key: string): Promise<boolean> {
  return outbox.cancel(kind, key).catch(() => false);
}

/** Still waiting to go out (not sent yet, not given up on after too many tries or days). */
export function queued(kind: string, key: string): Promise<boolean> {
  return outbox.has(kind, key).catch(() => false);
}

let started = false;
/** Once, at startup (after installFetchTimeout). */
export function startSync() {
  if (started || typeof globalThis.fetch !== 'function') return;
  started = true;
  globalThis.fetch = observeFetch(globalThis.fetch);
  onReconnect(() => drainSoon(true));
  AppState.addEventListener('change', (st) => {
    if (st !== 'active') return;
    if (isOnline()) drainSoon();
    else probeWhileOffline(API);
  });
  subscribeOnline((ok) => {
    if (!ok) probeWhileOffline(API);
  });
  // On the web the browser says when the network is back: queued work goes out then, not at the
  // next probe. It's a hint; a request that still fails marks us offline again.
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('online', () => reportNetwork(true));
  // First try a few seconds after launch, out of the way of startup.
  setTimeout(() => drainSoon(true), 5000);
}

export function useOnline(): boolean {
  const [ok, setOk] = useState(isOnline());
  useEffect(() => subscribeOnline(setOk), []);
  return ok;
}

/** How many things are waiting to be sent. */
export function usePending(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    outbox.size().then((x) => alive && setN(x));
    const off = outbox.subscribe(setN);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return n;
}
