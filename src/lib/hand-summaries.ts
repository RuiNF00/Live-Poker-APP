// The app's side of store/hand-summary: phone storage, the app version, and when to read and write.

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';

import type { Hand } from '@/poker/types';
import { forgetSummaries, loadSummaries, saveSummaries, SUMMARY_VERSION } from '@/store/hand-summary';

import { onEraseAll } from './erase-hooks';
import { Updates } from './updates-info';

// A new app version, or an over-the-air update of the same one, may replay differently: what was
// kept by another is worked out again.
const build = () => `${SUMMARY_VERSION}:${Constants.expoConfig?.version ?? '0'}:${Updates.updateId ?? 'embedded'}`;

let loading: Promise<void> | null = null;
/** Starts reading what was kept (once); resolves when done, never rejects. */
export function summariesReady(): Promise<void> {
  return (loading ??= loadSummaries(AsyncStorage, build()).then(
    () => {},
    () => {},
  ));
}

/** False until what was kept has been read, so a count over every hand doesn't replay them for nothing. */
export function useSummariesReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let on = true;
    void summariesReady().then(() => on && setReady(true));
    return () => {
      on = false;
    };
  }, []);
  return ready;
}

let timer: ReturnType<typeof setTimeout> | null = null;
/** Keeps the answers for the current hands, a moment after the last change. */
export function persistSummaries(hands: readonly Hand[]) {
  // An empty list is never the moment: before the store has loaded, it would drop everything kept
  // (and after «Apagar todos os meus dados» the storage is already empty).
  if (!hands.length) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void summariesReady().then(() => saveSummaries(AsyncStorage, build(), hands).catch(() => {}));
  }, 2000);
}

onEraseAll(() => {
  if (timer) clearTimeout(timer);
  timer = null;
  forgetSummaries();
});
