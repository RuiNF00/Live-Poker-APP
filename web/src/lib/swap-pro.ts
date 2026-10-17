import 'server-only';
import { hasPro } from './revenuecat';
import { groupStore } from './swap-groups';
import { swapStore } from './swaps';

// Settlement (who pays whom) follows the Pro of whoever created the swap or the group. The
// stored RevenueCat id is the app's claim, not proof; it is only ever read here, server-side.

/** A RevenueCat app user id as the app sends it, or null. */
export const rcUserIdOf = (v: unknown): string | null => (typeof v === 'string' && v.length >= 1 && v.length <= 100 ? v : null);

/** Whether the creator has Pro now. A missing id, an error or a slow answer reads as no (fail closed). */
export async function creatorPro(lookup: () => Promise<string | null>, ms = 2500): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const rc = await lookup();
    if (!rc) return false;
    const late = new Promise<boolean>((resolve) => (timer = setTimeout(() => resolve(false), ms)));
    return await Promise.race([hasPro(rc).catch(() => false), late]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export const swapCreatorPro = (id: string) => creatorPro(() => swapStore().ownerRc(id));
export const groupCreatorPro = (id: string) => creatorPro(() => groupStore().ownerRc(id));
