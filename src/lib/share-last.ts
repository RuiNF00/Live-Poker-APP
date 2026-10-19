// The Partilhar destination used last (see share-order.ts), kept on the phone.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { isShareKey, type ShareKey } from './share-order';

const KEY = 'rl.share.last.v1';
let last: ShareKey | null = null;

// Read once at start; a share sheet is never the first thing on screen, so it is in by then.
AsyncStorage.getItem(KEY)
  .then((v) => {
    if (!last && isShareKey(v)) last = v;
  })
  .catch(() => {});

export function lastShare(): ShareKey | null {
  return last;
}

export function rememberShare(k: ShareKey): void {
  last = k;
  AsyncStorage.setItem(KEY, k).catch(() => {});
}
