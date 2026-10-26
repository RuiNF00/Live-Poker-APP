// The version sent with a backer's page (lib/backer-page): the newest change this phone knows in
// the staking data, in ms. The server refuses a page older than the one it has, so a second phone
// opening with old data, before the cloud joins both copies, can't seal old numbers over new ones
// (Swaps QA P3, 19 Oct). Every session, piece, payment and delete counts, not only this backer's:
// a stake taken off a session no longer names the backer, but its edit is still news for them.

import type { Deleted } from '@/store/deleted-math';
import type { ActionOffer } from '@/store/action-offer';
import type { Backer, BackerPayment, Session, StakePackage } from '@/store/types';

// Sessions have no createdAt: when they started or ended stands in for an edit time older copies lack.
type Dated = { createdAt?: number; updatedAt?: number; startedAt?: number; endedAt?: number };

const LISTS = ['sessions:', 'packages:', 'payments:', 'backers:'];

export function pageVersion(data: { backers: Backer[]; sessions: Session[]; packages: StakePackage[]; payments: BackerPayment[]; offers: ActionOffer[]; deleted: Deleted }): number {
  let v = 0;
  const at = (x: Dated) => {
    const t = Math.max(x.updatedAt ?? 0, x.createdAt ?? 0, x.startedAt ?? 0, x.endedAt ?? 0);
    if (Number.isFinite(t) && t > v) v = t;
  };
  data.backers.forEach(at);
  data.sessions.forEach(at);
  data.packages.forEach(at);
  data.payments.forEach(at);
  data.offers.forEach(at);
  for (const [k, t] of Object.entries(data.deleted)) if (t > v && LISTS.some((l) => k.startsWith(l))) v = t;
  return Math.floor(v);
}
