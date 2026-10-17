// The edit token of a link the app is making (a shared hand, a backer live link), picked here and
// kept on the phone until the server's answer arrives. A create sent again with it (a retry after a
// lost answer, or the share queue once there's signal) gets the same link back, never a second one
// (web migration 340000). Same idea as the swap drafts' newCreateKey, but it survives a restart.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const KEY = 'rl.createKeys.v1';
let cache: Record<string, string> | null = null;

async function all(): Promise<Record<string, string>> {
  if (cache) return cache;
  try {
    const v: unknown = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}');
    cache = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

const save = (m: Record<string, string>) => AsyncStorage.setItem(KEY, JSON.stringify(m)).catch(() => {});

// One at a time: two creates for the same hand at once (the screen and the queue) share one token.
let chain: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn);
  chain = run.catch(() => undefined);
  return run;
}

/** The token for `scope` (e.g. "hand:<id>"): the same one until forgetCreateKey. */
export function createKey(scope: string): Promise<string> {
  return locked(async () => {
    const m = await all();
    if (!m[scope]) {
      m[scope] = Array.from(Crypto.getRandomBytes(32), (b) => b.toString(16).padStart(2, '0')).join('');
      await save(m);
    }
    return m[scope];
  });
}

/** The link exists (or must be made anew): the next create for `scope` gets a fresh token. */
export function forgetCreateKey(scope: string): Promise<void> {
  return locked(async () => {
    const m = await all();
    if (!(scope in m)) return;
    delete m[scope];
    await save(m);
  });
}
