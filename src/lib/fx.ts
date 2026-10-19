// Daily exchange rates from the European Central Bank (via Frankfurter: free,
// no key, no data about the player is sent). Kept on the phone, so totals in
// the player's own currency still work with no signal; refreshed at most once
// a day when there is.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

import { ECB_CODES } from '@/store/currencies';
import { dayKey, latestDay, mergeRates, type RateTable } from '@/store/fx-math';

const KEY = 'rl.fx.v1';
const API = 'https://api.frankfurter.dev/v1';
const SYMBOLS = ECB_CODES;

interface Cache {
  rates: RateTable;
  /** Earliest day asked for, so an older session triggers one more fetch. */
  since: string | null;
  checkedAt: number;
}

let cache: Cache = { rates: {}, since: null, checkedAt: 0 };
let loaded: Promise<void> | null = null;
let inFlight = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function load(): Promise<void> {
  if (!loaded) {
    loaded = AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const c = JSON.parse(raw) as Cache;
        if (c && c.rates && typeof c.rates === 'object') {
          // Through mergeRates so a damaged cache can't put junk in the table.
          cache = { rates: mergeRates({}, { base: 'EUR', rates: c.rates }), since: c.since ?? null, checkedAt: c.checkedAt ?? 0 };
          emit();
        }
      })
      .catch(() => {});
  }
  return loaded;
}

/** Fetches what the cache lacks: older days than it has, or anything newer than a day. */
export async function refreshRates(since: number, now = Date.now()): Promise<void> {
  await load();
  if (inFlight) return;
  const want = dayKey(Math.min(since, now));
  const fresh = now - cache.checkedAt < 12 * 3600000;
  const coversStart = !!cache.since && cache.since <= want;
  if (fresh && coversStart) return;
  // Only the gap: from the requested start if it is older than the cache, else from the last day held.
  const start = !coversStart ? want : (latestDay(cache.rates) ?? want);
  inFlight = true;
  try {
    const res = await fetch(`${API}/${start}..?symbols=${SYMBOLS.join(',')}`);
    if (!res.ok) return;
    const rates = mergeRates(cache.rates, await res.json());
    cache = { rates, since: !cache.since || want < cache.since ? want : cache.since, checkedAt: now };
    emit();
    await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // No signal: keep what we have and try again next time.
  } finally {
    inFlight = false;
  }
}

function subscribe(l: () => void) {
  void load();
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The cached rates; asks for the missing ones (back to `since`) when online. */
export function useRates(since: number | null): RateTable {
  const rates = useSyncExternalStore(
    subscribe,
    () => cache.rates,
    () => cache.rates,
  );
  useEffect(() => {
    if (since !== null) void refreshRates(since);
  }, [since]);
  return rates;
}
