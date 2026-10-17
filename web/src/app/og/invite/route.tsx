import { INVITE_DISCOUNT_PUBLIC, landingCopy } from '@/components/landing/copy';
import { previewLocale } from '@/lib/i18n';
import { inviteOgImage } from '@/lib/og-pages';

/** Link preview for every invite (/r/<code>): the code isn't on it, so one image per language serves all. */
export function GET(req: Request) {
  const locale = previewLocale(new URL(req.url).searchParams.get('lang'), req.headers.get('accept-language'));
  return inviteOgImage(`−${INVITE_DISCOUNT_PUBLIC}%`, landingCopy(locale).invite);
}
