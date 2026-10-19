// Kept apart from SwapReminder.tsx so the end-of-session row can record a result without
// bringing the reminder (and its sheets) into the screens that use it.

import { t } from '@/i18n';
import { notice } from '@/lib/notice';
import type { Session } from '@/store/types';
import type { Swap } from '@/store/swaps';
import { addEntry } from '@/store/swaps-store';
import type { SwapGroup } from '@/store/swap-groups';
import { addGroupPrize } from '@/store/swap-groups-store';

/**
 * My result in each swap and group of this tournament: the prize, the event and the place,
 * nothing else. Tells the player when one of them is full (nothing saved there).
 */
export async function record(s: Session, swaps: Swap[], groups: SwapGroup[]) {
  let full = false;
  for (const sw of swaps) {
    const r = await addEntry(sw.id, { kind: 'result', amount: s.cashOut || 0, event: s.name || sw.terms.title, finish: s.finish ?? null }, s.id).catch(() => 'queued');
    if (r === 'full') full = true;
  }
  for (const g of groups) {
    const r = await addGroupPrize(g.id, { kind: 'result', amount: s.cashOut || 0, event: s.name || g.terms.title, finish: s.finish ?? null }, s.id).catch(() => 'queued');
    if (r === 'full') full = true;
  }
  if (full) notice(t('Swap cheio'), t('Este swap já tem o máximo de registos. Cria um swap novo para os próximos torneios.'));
}
