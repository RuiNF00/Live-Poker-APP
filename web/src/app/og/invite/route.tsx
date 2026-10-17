import { REWARD_DAYS_PUBLIC } from '@/components/landing/copy';
import { inviteOgImage } from '@/lib/og-pages';

/** Link preview for every invite (/r/<code>): the code isn't on it, so one image serves all. */
export function GET() {
  return inviteOgImage(REWARD_DAYS_PUBLIC);
}
