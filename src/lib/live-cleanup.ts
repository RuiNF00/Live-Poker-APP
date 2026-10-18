// A backer live link outlives nothing: when its session is deleted the public
// page goes too, now or when the signal is back.

import { deleteLive } from './live-link';
import { outcomeOf, queue, registerSender } from './sync';

export function queueLiveDelete(live: { id: string; token: string }) {
  queue('live-delete', live, live.id);
}

registerSender('live-delete', async (p) => {
  try {
    await deleteLive(p as { id: string; token: string });
    return 'done';
  } catch (e) {
    const m = /^live (\d+)$/.exec((e as Error)?.message ?? '');
    return m ? outcomeOf(Number(m[1])) : 'retry';
  }
});
