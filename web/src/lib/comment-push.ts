import 'server-only';
import { getStore } from './store';

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

/**
 * "Novo comentário na tua mão": tells the hand's owner, through Expo's push service (the APNs and
 * FCM keys live in EAS, none here). The database decides whether one may go now (quiet hours,
 * one per hand until opened) and writes the text; what waits is sent later by its pg_cron job.
 * Never throws: a comment never fails because of its notice.
 */
export async function notifyOwner(handId: string, street: string | null): Promise<void> {
  try {
    const store = getStore();
    const out = await store.queueCommentPush(handId, street);
    if (!out.length) return;
    const res = await fetch(EXPO_PUSH, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(out.map((m) => m.message)),
    });
    const j = (await res.json().catch(() => null)) as { data?: { status?: string; details?: { error?: string } }[] } | null;
    await Promise.all(
      (j?.data ?? []).map((ticket, i) => (ticket?.details?.error === 'DeviceNotRegistered' && out[i] ? store.dropCommentPush(out[i].handId) : null)),
    );
  } catch (e) {
    console.warn('[comment-push]', (e as Error)?.message);
  }
}
