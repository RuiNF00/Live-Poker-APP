import { OG_SIZE, siteOgImage } from '@/lib/og-pages';

export const alt = 'Sweatbook';
export const size = OG_SIZE;
export const contentType = 'image/png';

/** Preview for the bare site link (Instagram bio, WhatsApp). Shared hands have their own. */
export default function Image() {
  return siteOgImage();
}
