// "Delete all my data" for swaps: each swap this player created or confirmed is deleted on
// the server with its token, now or when the signal is back (outbox), and the phone forgets
// them. Imported at startup so the sender is registered before the outbox drains.

import { getAllSwaps, forgetSwapsLocally } from '@/store/swaps-store';
import { swapDeleteJobs } from '@/store/swaps';

import { onEraseAll } from './erase-all';
import { deleteSwap, SwapError } from './swap-api';
import { outcomeOf, queue, registerSender } from './sync';

/** Queues the server deletes, then empties the phone's list. */
export async function eraseSwaps(): Promise<void> {
  for (const job of swapDeleteJobs(await getAllSwaps())) queue('swap-delete', job, job.id);
  forgetSwapsLocally();
}

registerSender('swap-delete', async (p) => {
  const { id, token } = p as { id: string; token: string };
  try {
    await deleteSwap(id, token);
    return 'done';
  } catch (e) {
    return e instanceof SwapError ? outcomeOf(e.status) : 'retry';
  }
});

onEraseAll(eraseSwaps);
