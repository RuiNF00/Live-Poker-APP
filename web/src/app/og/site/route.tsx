import { previewLocale } from '@/lib/i18n';
import { siteOgImage } from '@/lib/og-pages';

/** The site's link preview in the page's language (/og/site?lang=en): one image per language. */
export function GET(req: Request) {
  return siteOgImage(previewLocale(new URL(req.url).searchParams.get('lang'), req.headers.get('accept-language')));
}

