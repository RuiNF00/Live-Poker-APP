// "Delete all my data" (Settings): the phone forgets everything, and every public
// copy goes too: share links, backer live pages, the cloud copy, the public profile,
// and whatever a feature registers with onEraseAll. Server deletes go through the
// outbox, so they also work without signal.

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Hand } from '@/poker/types';
import { clearOffers, storedOffers } from '@/store/action-offer';
import type { Backer, Session } from '@/store/types';

import { lockSupported, saveLock } from './app-lock';
import { loadCloud, queueCloudDelete, rememberedCode, saveCloud } from './cloud-backup';
import { dropAllDocs } from './docs';
import { eraseInOrder, keysToErase } from './erase-core';
import { runErasers } from './erase-hooks';
import { queueBackerPageDelete } from './backer-page';
import { queueLiveDelete } from './live-cleanup';
import { notifications } from './lock-screen/reminder';
import { queueAgreementDelete } from './offer-api';
import { queueProfileDelete } from './public-profile';
import { forgetHandShare } from './share-queue';
import { dropSupportCopies } from './support-cache';
import { dropAllVoiceNotes } from './voice-note';

export { onEraseAll } from './erase-hooks';

/** Step 1, before the store empties: queue the delete of every public copy. */
export async function eraseRemote(d: { hands: Pick<Hand, 'id' | 'shareId' | 'shareToken'>[]; sessions: Pick<Session, 'live'>[]; backers?: Pick<Backer, 'page'>[] }) {
  // After a reinstall the only trace of the cloud copy may be the code in the keychain.
  const cloud = (await loadCloud()) ?? (await rememberedCode());
  await eraseInOrder(
    cloud,
    queueCloudDelete,
    async () => {
      for (const h of d.hands) await forgetHandShare(h).catch(() => {});
      for (const s of d.sessions) if (s.live) queueLiveDelete(s.live);
      // Backers' fixed links (sealed: the server can't read them, but they go anyway).
      for (const b of d.backers ?? []) if (b.page) queueBackerPageDelete(b.page);
      // Action-package links: one private page per backer. (Statement links keep their
      // numbers in the URL fragment, so there's nothing of them on the server to delete.)
      for (const o of await storedOffers()) for (const l of o.lines) if (l.remote) queueAgreementDelete(l.remote);
      await clearOffers();
      await queueProfileDelete().catch(() => {});
      await runErasers();
    },
    // Also forgets the code kept in the keychain (it outlives reinstalling the app).
    () => saveCloud(null).catch(() => {}),
  );
}

/** Step 2, after the store wrote its empty lists: everything else on the phone. */
export async function eraseLocal() {
  const keys = keysToErase(await AsyncStorage.getAllKeys().catch(() => [] as readonly string[]));
  if (keys.length) await AsyncStorage.multiRemove(keys).catch(() => {});
  if (lockSupported) await saveLock(null).catch(() => {});
  // Files next to the data: receipt and tax-form photos, voice notes on hands.
  dropAllDocs();
  dropAllVoiceNotes();
  // Import files picked from the phone and copies made for support.
  dropSupportCopies();
  // Festival and level reminders, trial nudges: the Pro nudges are planned again from the empty data.
  await notifications()?.cancelAllScheduledNotificationsAsync().catch(() => {});
}
