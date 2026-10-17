// "Delete all my data" for swaps: each swap this player created or confirmed is deleted on
// the server with its token, now or when the signal is back (outbox), and the phone forgets
// them. Imported at startup so the sender is registered before the outbox drains.

import { groupLeaveJobs } from '@/store/swap-groups';
import { forgetGroupsLocally, getAllGroups } from '@/store/swap-groups-store';
import { getAllSwaps, forgetSwapsLocally } from '@/store/swaps-store';
import { swapDeleteJobs } from '@/store/swaps';

import { onEraseAll } from './erase-all';
import { deleteSwap, SwapError } from './swap-api';
import { leaveGroup } from './swap-group-api';
import { outcomeOf, queue, registerSender } from './sync';

/** Queues the server deletes, then empties the phone's list. */
export async function eraseSwaps(): Promise<void> {
  // The other player keeps a read-only copy (amounts as they were); my side's name and token go.
  for (const job of swapDeleteJobs(await getAllSwaps())) queue('swap-leave', job, job.id);
  forgetSwapsLocally();
  // Groups: the creator's goes for everyone; anyone else's seat is emptied (name and token gone).
  for (const job of groupLeaveJobs(await getAllGroups())) queue('swap-group-leave', job, job.id);
  forgetGroupsLocally();
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

registerSender('swap-leave', async (p) => {
  const { id, token } = p as { id: string; token: string };
  try {
    await deleteSwap(id, token, true);
    return 'done';
  } catch (e) {
    return e instanceof SwapError ? outcomeOf(e.status) : 'retry';
  }
});

registerSender('swap-group-leave', async (p) => {
  const { id, token } = p as { id: string; token: string };
  try {
    await leaveGroup(id, token);
    return 'done';
  } catch (e) {
    return e instanceof SwapError ? outcomeOf(e.status) : 'retry';
  }
});

onEraseAll(eraseSwaps);
