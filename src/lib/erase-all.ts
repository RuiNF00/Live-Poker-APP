// "Delete all my data" (Settings): the phone forgets everything, and every public
// copy goes too: share links, backer live pages, the cloud copy, the public profile,
// and whatever a feature registers with onEraseAll. Server deletes go through the
// outbox, so they also work without signal.

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Hand } from '@/poker/types';
import type { Session } from '@/store/types';

import { lockSupported, saveLock } from './app-lock';
import { loadCloud, queueCloudDelete, saveCloud } from './cloud-backup';
import { keysToErase } from './erase-core';
import { queueLiveDelete } from './live-cleanup';
import { notifications } from './lock-screen/reminder';
import { queueProfileDelete } from './public-profile';
import { forgetHandShare } from './share-queue';

type Eraser = () => void | Promise<void>;
const erasers = new Set<Eraser>();

/**
 * A feature with its own public copy or local cache registers how to delete it.
 * Server deletes should be queued (see sync.queue), never awaited on the network.
 */
export function onEraseAll(fn: Eraser): () => void {
  erasers.add(fn);
  return () => erasers.delete(fn);
}

/** Step 1, before the store empties: queue the delete of every public copy. */
export async function eraseRemote(d: { hands: Pick<Hand, 'id' | 'shareId' | 'shareToken'>[]; sessions: Pick<Session, 'live'>[] }) {
  for (const h of d.hands) await forgetHandShare(h).catch(() => {});
  for (const s of d.sessions) if (s.live) queueLiveDelete(s.live);
  const cloud = await loadCloud();
  if (cloud) {
    queueCloudDelete(cloud);
    await saveCloud(null).catch(() => {});
  }
  await queueProfileDelete().catch(() => {});
  for (const fn of erasers) await Promise.resolve(fn()).catch(() => {});
}

/** Step 2, after the store wrote its empty lists: everything else on the phone. */
export async function eraseLocal() {
  const keys = keysToErase(await AsyncStorage.getAllKeys().catch(() => [] as readonly string[]));
  if (keys.length) await AsyncStorage.multiRemove(keys).catch(() => {});
  if (lockSupported) await saveLock(null).catch(() => {});
  // Festival and level reminders, trial nudges: the Pro nudges are planned again from the empty data.
  await notifications()?.cancelAllScheduledNotificationsAsync().catch(() => {});
}
