import 'server-only';
import { hasPro } from './revenuecat';
import { groupStore } from './swap-groups';
import { swapStore } from './swaps';

// Settlement (who pays whom) follows the Pro of whoever created the swap or the group. The
// stored RevenueCat id is the app's claim, not proof; it is only ever read here, server-side,
// and never leaves the server (no read of a swap, page, log or event carries it).

/**
 * A RevenueCat anonymous app user id, or null. Only the anonymous form is taken: 32 random hex
 * nobody can guess, so a claimed id is as good as proof (Security, 19 Oct). If the app ever calls
 * Purchases.logIn with its own ids (src/billing/purchases.ts identify), this stops being enough:
 * the server then needs a proof of the id, such as one signed from the RevenueCat webhook.
 */
export const rcUserIdOf = (v: unknown): string | null => (typeof v === 'string' && /^\$RCAnonymousID:[0-9a-f]{32}$/.test(v) ? v : null);

/** Whether the creator has Pro now. A missing id, an error or a slow answer reads as no (fail closed). */
export async function creatorPro(lookup: () => Promise<string | null>, ms = 2500): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Ids stored before the format check are checked again here.
    const rc = rcUserIdOf(await lookup());
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
