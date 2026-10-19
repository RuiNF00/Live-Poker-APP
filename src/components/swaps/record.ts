// Kept apart from SwapReminder.tsx so the end-of-session row can record a result without
// bringing the reminder (and its sheets) into the screens that use it.

import type { Session } from '@/store/types';
import type { Swap } from '@/store/swaps';
import { addEntry } from '@/store/swaps-store';
import type { SwapGroup } from '@/store/swap-groups';
import { addGroupPrize } from '@/store/swap-groups-store';

/** My result in each swap and group of this tournament: the prize, the event and the place, nothing else. */
export async function record(s: Session, swaps: Swap[], groups: SwapGroup[]) {
  for (const sw of swaps) {
    await addEntry(sw.id, { kind: 'result', amount: s.cashOut || 0, event: s.name || sw.terms.title, finish: s.finish ?? null }, s.id).catch(() => 'queued');
  }
  for (const g of groups) {
    await addGroupPrize(g.id, { kind: 'result', amount: s.cashOut || 0, event: s.name || g.terms.title, finish: s.finish ?? null }, s.id).catch(() => 'queued');
  }
}
